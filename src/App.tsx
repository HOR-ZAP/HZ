import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { HikeForm } from './components/HikeForm';
import { HikeList } from './components/HikeList';
import { MapView } from './components/MapView';
import { Route3DView } from './components/Route3DView';
import { AnalyticsView } from './components/AnalyticsView';
import { MilestonesView } from './components/MilestonesView';
import { PrintReportView } from './components/PrintReportView';
import { PlannedRoutesView, DISTINCT_ROUTE_COLORS } from './components/PlannedRoutesView';
import { ParticipantsView } from './components/ParticipantsView';
import { AccommodationView } from './components/AccommodationView';
import { Toast, ToastType } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { OfflineModal } from './components/OfflineModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AccountLicenseModal, AccountModalTab } from './components/AccountLicenseModal';
import { WelcomeOnboardingBanner } from './components/WelcomeOnboardingBanner';
import { Hike, HikeActivity, FilterState, RoutePart, PlannedRoute, ParticipantProfile } from './types';
import {
  initializeLocalStore,
  addLocalHike,
  updateLocalHike,
  deleteLocalHike,
  replaceAllLocalHikes,
  addLocalPlannedRoute,
  updateLocalPlannedRoute,
  deleteLocalPlannedRoute,
  replaceAllLocalPlannedRoutes,
  saveLocalParticipantProfile,
  replaceAllLocalParticipants,
  normalizeImportedHikes,
  normalizeImportedPlannedRoutes,
  getMetaValue,
  setMetaValue,
} from './services/localStore';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  clearAccessToken,
  logout as googleLogout,
  GoogleUserInfo,
} from './services/googleAuth';
import {
  findDriveBackupFile,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  DriveBackupInfo,
  DriveAuthExpiredError,
} from './services/driveSync';
import {
  LicenseState,
  ProFeatureId,
  PublicBillingConfig,
  FREE_MAX_HIKES,
  FREE_MAX_PLANNED,
  LIFETIME_PRICE_CZK,
  LIFETIME_PRICE_EUR,
  hasProAccess,
  getTrialDaysRemaining,
  loadLicenseStateSync,
  loadLicenseState,
  activateSevenDayTrial,
  activateLicenseKeyOnServer,
  deactivateToFree,
  fetchPublicBillingConfig,
} from './services/licensing';
import { exportHikesToExcel } from './utils/excelExport';
import {
  parseGpxXml,
  calculateCoordsDistanceKm,
  getEffectiveHikeDistanceKm,
} from './utils/gpxParser';
import { evaluateMilestonesForParticipant } from './utils/milestonesUtils';
import { sendMilestoneEmailNotification, downloadMilestoneCardPng } from './utils/milestoneCardGenerator';
import { useOfflineMode } from './utils/offlineManager';
import { loadSampleHikesPayloads, loadSamplePlannedRoutePayload } from './utils/sampleHike';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [hikes, setHikes] = useState<Hike[]>([]);
  const [plannedRoutes, setPlannedRoutes] = useState<PlannedRoute[]>([]);
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, ParticipantProfile>>({});

  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState<boolean>(false);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState<boolean>(false);
  const [splashRemoved, setSplashRemoved] = useState<boolean>(false);
  const [editingHike, setEditingHike] = useState<Hike | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedMapIndex, setSelectedMapIndex] = useState<number | null>(null);
  const [selectedPlannedRouteId, setSelectedPlannedRouteId] = useState<string | null>(null);

  // Offline mode & PWA map cache state
  const { isOnline, isManualOffline, isOffline, setManualOffline } = useOfflineMode();
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false);

  // Licensing & Billing state
  const [licenseState, setLicenseState] = useState<LicenseState>(() => loadLicenseStateSync());
  const [billingConfig, setBillingConfig] = useState<PublicBillingConfig>({
    checkoutUrl: '',
    priceLifetimeCzk: LIFETIME_PRICE_CZK,
    priceLifetimeEur: LIFETIME_PRICE_EUR,
    supportEmail: '',
    operatorName: '',
    operatorIco: '',
    operatorAddress: '',
  });

  // New-user onboarding banner state
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean>(false);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);
  const onboardingGpxInputRef = useRef<HTMLInputElement>(null);

  // Account & PRO Modal state
  const [accountModal, setAccountModal] = useState<{
    isOpen: boolean;
    tab: AccountModalTab;
    lockedFeature: ProFeatureId | null;
  }>({
    isOpen: false,
    tab: 'license',
    lockedFeature: null,
  });

  // Google Drive user & backup state (access token is kept strictly in memory in googleAuth.ts)
  const [googleUser, setGoogleUser] = useState<GoogleUserInfo | null>(null);
  const [hasActiveDriveToken, setHasActiveDriveToken] = useState<boolean>(false);
  const [driveBackupInfo, setDriveBackupInfo] = useState<DriveBackupInfo | null>(null);
  const [isDriveBusy, setIsDriveBusy] = useState<boolean>(false);

  const isPro = useMemo(() => hasProAccess(licenseState), [licenseState]);
  const trialDaysLeft = useMemo(() => getTrialDaysRemaining(licenseState), [licenseState]);
  const isDriveConnected = Boolean(googleUser && hasActiveDriveToken);

  // Journal filter state
  const [filterState, setFilterState] = useState<FilterState>({
    year: 'all',
    month: 'all',
    participant: 'all',
    activity: 'all',
  });

  // Toast
  const [toast, setToast] = useState<{ message: string | null; type: ToastType }>({
    message: null,
    type: 'success',
  });

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  }, []);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const openAccountModal = useCallback(
    (tab: AccountModalTab = 'license', lockedFeature: ProFeatureId | null = null) => {
      setAccountModal({
        isOpen: true,
        tab: lockedFeature ? 'license' : tab,
        lockedFeature,
      });
    },
    []
  );

  // Initialize local IndexedDB data, license state, public pricing config, and Google Auth listener
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [storeData, loadedLicense, publicCfg, dismissedFlag] = await Promise.all([
          initializeLocalStore(),
          loadLicenseState(),
          fetchPublicBillingConfig(),
          getMetaValue<boolean>('welcome_dismissed_v1'),
        ]);
        if (!active) return;
        setHikes(storeData.hikes);
        setPlannedRoutes(storeData.plannedRoutes);
        setParticipantProfiles(storeData.participants);
        setLicenseState(loadedLicense);
        setBillingConfig(publicCfg);
        if (dismissedFlag) setWelcomeDismissed(true);
      } catch (err) {
        console.warn('Local store initialization warning:', err);
      } finally {
        if (active) setIsInitialDataLoaded(true);
      }
    })();

    const unsubscribeAuth = initAuth((user) => {
      if (!active) return;
      setGoogleUser(user);
      if (!user) {
        setHasActiveDriveToken(false);
        setDriveBackupInfo(null);
      } else {
        setHasActiveDriveToken(Boolean(getAccessToken()));
      }
    });

    const dataFallbackTimer = window.setTimeout(() => {
      if (active) setIsInitialDataLoaded(true);
    }, 2000);

    return () => {
      active = false;
      window.clearTimeout(dataFallbackTimer);
      unsubscribeAuth();
    };
  }, []);

  // Minimum splash display duration & fallback safety timer
  useEffect(() => {
    const minTimer = window.setTimeout(() => {
      setMinSplashElapsed(true);
    }, 1100);
    const maxSafetyTimer = window.setTimeout(() => {
      setIsInitialDataLoaded(true);
      setIsMapReady(true);
      setMinSplashElapsed(true);
    }, 3500);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxSafetyTimer);
    };
  }, []);

  const isAppAndMapLoaded =
    minSplashElapsed && isInitialDataLoaded && (isMapReady || activeTab !== 'map');

  useEffect(() => {
    if (!isAppAndMapLoaded) return;
    const fadeTimer = window.setTimeout(() => {
      setSplashRemoved(true);
    }, 550);
    return () => window.clearTimeout(fadeTimer);
  }, [isAppAndMapLoaded]);

  // Tab navigation with PRO gating
  const handleSelectTab = useCallback(
    (tab: ActiveTab) => {
      if (!isPro) {
        if (tab === 'route3d' || tab === 'planned3d') {
          openAccountModal('license', 'route3d');
          return;
        }
        if (tab === 'accommodation') {
          openAccountModal('license', 'accommodation');
          return;
        }
        if (tab === 'print') {
          openAccountModal('license', 'exports');
          return;
        }
        if (tab === 'participants') {
          openAccountModal('license', 'participants_notify');
          return;
        }
      }
      setActiveTab(tab);
    },
    [isPro, openAccountModal]
  );

  // Manual offline toggle
  const handleToggleManualOffline = useCallback(
    (enabled: boolean) => {
      setManualOffline(enabled);
      showToast(
        enabled
          ? 'Ruční offline režim byl zapnut. Aplikace pracuje z uložených dat a map.'
          : 'Ruční offline režim byl vypnut.',
        enabled ? 'warning' : 'success'
      );
    },
    [setManualOffline, showToast]
  );

  // Google Drive Auth & Sync handlers
  const refreshDriveBackupStatus = useCallback(
    async (explicitToken?: string) => {
      const token = explicitToken || getAccessToken();
      if (!token) {
        setHasActiveDriveToken(false);
        return;
      }
      setIsDriveBusy(true);
      try {
        const info = await findDriveBackupFile(token);
        setDriveBackupInfo(info);
        setHasActiveDriveToken(true);
      } catch (err: unknown) {
        if (err instanceof DriveAuthExpiredError) {
          clearAccessToken();
          setHasActiveDriveToken(false);
          showToast(err.message, 'warning');
        } else {
          const e = err as Error;
          showToast(e?.message || 'Nepodařilo se zkontrolovat zálohu na Google Disku.', 'error');
        }
      } finally {
        setIsDriveBusy(false);
      }
    },
    [showToast]
  );

  const handleGoogleSignIn = useCallback(async () => {
    if (isOffline) {
      showToast('Pro přihlášení ke Google Disku vypněte offline režim.', 'warning');
      return;
    }
    setIsDriveBusy(true);
    try {
      const { user, accessToken } = await googleSignIn();
      setGoogleUser(user);
      setHasActiveDriveToken(true);
      const info = await findDriveBackupFile(accessToken);
      setDriveBackupInfo(info);
      showToast('Google Disk byl úspěšně připojen.', 'success');
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e?.message || 'Přihlášení přes Google se nezdařilo.', 'error');
    } finally {
      setIsDriveBusy(false);
    }
  }, [isOffline, showToast]);

  const handleGoogleSignOut = useCallback(async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setHasActiveDriveToken(false);
      setDriveBackupInfo(null);
      showToast('Google účet byl odhlášen. Lokální data v zařízení zůstala zachována.', 'success');
    } catch {
      showToast('Odhlášení se nezdařilo.', 'error');
    }
  }, [showToast]);

  const handleRequestDriveBackup = useCallback(() => {
    if (!isPro) {
      openAccountModal('license', 'drive_sync');
      return;
    }
    const token = getAccessToken();
    if (!token) {
      showToast('Přihlaste se prosím znovu k Google Disku.', 'warning');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Uložit zálohu na Google Disk',
      message: driveBackupInfo
        ? `Chystáte se přepsat soubor "${driveBackupInfo.name}" na vašem Google Disku aktuálním archívem (${hikes.length} výšlapů, ${plannedRoutes.length} plánovaných tras). Přejete si pokračovat?`
        : `Chystáte se vytvořit záložní soubor "horsky-zapisnik-zaloha.json" na vašem Google Disku (${hikes.length} výšlapů, ${plannedRoutes.length} plánovaných tras). Přejete si pokračovat?`,
      confirmText: 'Ano, uložit na Google Disk',
      isDestructive: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setIsDriveBusy(true);
        try {
          const updatedInfo = await uploadBackupToDrive(
            token,
            {
              version: '4.1.0-pro',
              app: 'Horský zápisník a Archív tras',
              exportedAt: new Date().toISOString(),
              hikes,
              plannedRoutes,
              participants: participantProfiles,
            },
            driveBackupInfo?.id
          );
          setDriveBackupInfo(updatedInfo);
          showToast('Záloha byla úspěšně uložena na váš Google Disk.', 'success');
        } catch (err: unknown) {
          if (err instanceof DriveAuthExpiredError) {
            clearAccessToken();
            setHasActiveDriveToken(false);
            showToast(err.message, 'warning');
          } else {
            const e = err as Error;
            showToast(e?.message || 'Uložení na Google Disk se nezdařilo.', 'error');
          }
        } finally {
          setIsDriveBusy(false);
        }
      },
    });
  }, [
    isPro,
    openAccountModal,
    driveBackupInfo,
    hikes,
    plannedRoutes,
    participantProfiles,
    showToast,
  ]);

  const handleRequestDriveRestore = useCallback(() => {
    if (!isPro) {
      openAccountModal('license', 'drive_sync');
      return;
    }
    const token = getAccessToken();
    if (!token || !driveBackupInfo) {
      showToast('Na Google Disku nebyla nalezena žádná záloha k obnovení.', 'warning');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Obnovit archív z Google Disku',
      message: `Chystáte se stáhnout zálohu "${driveBackupInfo.name}" z Google Disku a nahradit aktuální lokální data v tomto zařízení. Přejete si pokračovat?`,
      confirmText: 'Ano, obnovit z Google Disku',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setIsDriveBusy(true);
        try {
          const downloaded = await downloadBackupFromDrive(token, driveBackupInfo.id);
          const restoredHikes = await normalizeImportedHikes(downloaded.hikes);
          const restoredPlanned = await normalizeImportedPlannedRoutes(downloaded.plannedRoutes);
          restoredHikes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

          await replaceAllLocalHikes(restoredHikes);
          await replaceAllLocalPlannedRoutes(restoredPlanned);
          await replaceAllLocalParticipants(downloaded.participants);

          setHikes(restoredHikes);
          setPlannedRoutes(restoredPlanned);
          setParticipantProfiles(downloaded.participants);
          setSelectedTripId(null);
          setSelectedPlannedRouteId(null);

          showToast(
            `Obnoveno ${restoredHikes.length} výšlapů a ${restoredPlanned.length} plánovaných tras z Google Disku.`,
            'success'
          );
        } catch (err: unknown) {
          if (err instanceof DriveAuthExpiredError) {
            clearAccessToken();
            setHasActiveDriveToken(false);
            showToast(err.message, 'warning');
          } else {
            const e = err as Error;
            showToast(e?.message || 'Obnovení z Google Disku se nezdařilo.', 'error');
          }
        } finally {
          setIsDriveBusy(false);
        }
      },
    });
  }, [isPro, openAccountModal, driveBackupInfo, showToast]);

  // License handlers
  const handleStartTrial = useCallback(async () => {
    try {
      const next = await activateSevenDayTrial(licenseState);
      setLicenseState(next);
      setAccountModal((prev) => ({ ...prev, lockedFeature: null }));
      showToast('7denní zkušební verze PRO byla aktivována! Všechny funkce jsou odemčeny.', 'success');
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e?.message || 'Zkušební verzi se nepodařilo spustit.', 'warning');
    }
  }, [licenseState, showToast]);

  const handleActivateLicenseKey = useCallback(
    async (key: string, email: string) => {
      const { state, message } = await activateLicenseKeyOnServer(key, email, licenseState);
      setLicenseState(state);
      setAccountModal((prev) => ({ ...prev, lockedFeature: null }));
      showToast(message, 'success');
    },
    [licenseState, showToast]
  );

  const handleRequestDeactivateLicense = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Deaktivovat PRO licenci na tomto zařízení',
      message:
        'Opravdu chcete přepnout aplikaci zpět do bezplatné verze Start? Vaše uložené výšlapy v zařízení zůstanou zachovány.',
      confirmText: 'Ano, deaktivovat',
      isDestructive: true,
      onConfirm: async () => {
        const next = await deactivateToFree(licenseState);
        setLicenseState(next);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('PRO licence byla na tomto zařízení deaktivována.', 'warning');
      },
    });
  }, [licenseState, showToast]);

  // Total stats (excluding non-contiguous transfers / přejezdy)
  const { totalDistance, totalTrips } = useMemo(() => {
    const totalKm = hikes.reduce((sum, h) => {
      const d = getEffectiveHikeDistanceKm(h);
      return sum + (isNaN(d) ? 0 : d);
    }, 0);
    return {
      totalDistance: totalKm,
      totalTrips: hikes.length,
    };
  }, [hikes]);

  // Save participant profile (email / notified milestones)
  const handleSaveParticipantProfile = useCallback(async (profile: ParticipantProfile) => {
    const saved = await saveLocalParticipantProfile(profile);
    setParticipantProfiles((prev) => ({
      ...prev,
      [saved.name]: saved,
    }));
  }, []);

  // Check if a newly saved or edited hike unlocked any new milestones for participants with an email
  const checkAndNotifyNewMilestones = async (
    previousHikes: Hike[],
    updatedHikesList: Hike[],
    participantsStr?: string
  ) => {
    if (!participantsStr || !isPro) return;
    const names = participantsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const name of names) {
      const profile = participantProfiles[name];
      const email = profile?.email?.trim();
      if (!email) continue;

      const beforeCompleted = new Set(
        evaluateMilestonesForParticipant(previousHikes, name)
          .filter((m) => m.isCompleted)
          .map((m) => m.id)
      );
      const afterCompleted = evaluateMilestonesForParticipant(updatedHikesList, name).filter(
        (m) => m.isCompleted
      );
      const alreadyNotified = new Set(profile?.notifiedMilestones || []);

      const newlyUnlocked = afterCompleted.filter(
        (m) => !beforeCompleted.has(m.id) && !alreadyNotified.has(m.id)
      );

      if (newlyUnlocked.length > 0) {
        const nextNotified = Array.from(
          new Set([...alreadyNotified, ...newlyUnlocked.map((m) => m.id)])
        );

        await handleSaveParticipantProfile({
          name,
          email,
          notifiedMilestones: nextNotified,
        });

        for (const milestone of newlyUnlocked) {
          downloadMilestoneCardPng(milestone, name);
          await sendMilestoneEmailNotification({
            participantName: name,
            email,
            milestone,
          });
          showToast(
            `Účastník ${name} splnil milník "${milestone.title}"! Oznámení s milníkem bylo odesláno na ${email}.`,
            'success'
          );
        }
      }
    }
  };

  // Handle saving new or edited hike (instant local-first IndexedDB storage)
  const handleSaveHike = async (hikeData: {
    name: string;
    distance: number;
    date: string;
    dateTo?: string;
    participants?: string;
    note?: string;
    activity?: HikeActivity;
    routes: RoutePart[];
  }) => {
    const previousHikes = [...hikes];

    if (editingHike) {
      const updated = await updateLocalHike(editingHike.id, hikeData);
      const updatedList = previousHikes
        .map((h) => (h.id === editingHike.id ? updated : h))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setHikes(updatedList);
      setEditingHike(null);
      showToast('Výšlap byl úspěšně upraven', 'success');
      await checkAndNotifyNewMilestones(previousHikes, updatedList, hikeData.participants);
    } else {
      if (!isPro && hikes.length >= FREE_MAX_HIKES) {
        openAccountModal('license', 'unlimited_hikes');
        return;
      }
      const created = await addLocalHike(hikeData);
      const updatedList = [created, ...previousHikes].sort((a, b) =>
        (b.date || '').localeCompare(a.date || '')
      );
      setHikes(updatedList);
      showToast('Nový výšlap byl úspěšně uložen do zařízení', 'success');
      await checkAndNotifyNewMilestones(previousHikes, updatedList, hikeData.participants);
    }
  };

  // Handle delete hike
  const handleDeleteHike = (id: string) => {
    const hike = hikes.find((h) => h.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Smazat záznam výšlapu',
      message: `Opravdu chcete smazat výšlap "${hike?.name || 'Zvolený výšlap'}" z lokálního archívu?`,
      confirmText: 'Ano, smazat',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteLocalHike(id);
          setHikes((prev) => prev.filter((h) => h.id !== id));
          if (editingHike?.id === id) setEditingHike(null);
          if (selectedTripId === id) setSelectedTripId(null);
          showToast('Výšlap byl smazán', 'success');
        } catch {
          showToast('Smazání výšlapu se nezdařilo', 'error');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Handle save or update Planned Route
  const handleSavePlannedRoute = async (
    routeData: {
      name: string;
      distance: number;
      link?: string;
      note?: string;
      color?: string;
      routes: RoutePart[];
    },
    editingId?: string
  ): Promise<string> => {
    if (editingId) {
      const existing = plannedRoutes.find((r) => r.id === editingId);
      const updated = await updateLocalPlannedRoute(editingId, routeData, existing?.createdAt);
      setPlannedRoutes((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      showToast('Plánovaná trasa byla upravena', 'success');
      return editingId;
    } else {
      if (!isPro && plannedRoutes.length >= FREE_MAX_PLANNED) {
        openAccountModal('license', 'unlimited_planned');
        return '';
      }
      const created = await addLocalPlannedRoute(routeData);
      setPlannedRoutes((prev) => [created, ...prev]);
      showToast('Plánovaná trasa byla uložena', 'success');
      return created.id;
    }
  };

  // Handle delete Planned Route
  const handleDeletePlannedRoute = (id: string) => {
    const target = plannedRoutes.find((r) => r.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Smazat plánovanou trasu',
      message: `Opravdu chcete odstranit plánovanou trasu "${target?.name || 'Zvolená trasa'}"?`,
      confirmText: 'Ano, smazat',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteLocalPlannedRoute(id);
          setPlannedRoutes((prev) => prev.filter((r) => r.id !== id));
          showToast('Plánovaná trasa byla smazána', 'success');
        } catch {
          showToast('Smazání plánované trasy se nezdařilo', 'error');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Show trip on Map
  const handleShowOnMap = (tripId: string) => {
    setSelectedTripId(tripId);
    setSelectedMapIndex(null);
    setActiveTab('map');
  };

  // Show trip in Analytics
  const handleShowAnalytics = (tripId: string) => {
    setSelectedTripId(tripId);
    setActiveTab('analytics');
  };

  // MapView cloud button -> opens Google Drive backup tab
  const handleRefreshCloud = async () => {
    if (isOffline) {
      showToast('Jste v offline režimu – zobrazují se uložená lokální data.', 'warning');
      return;
    }
    openAccountModal('drive');
  };

  // Load real GPX sample hikes (Králický Sněžník, Lysá hora) + planned route (Šumava) for new users
  const handleLoadSampleTrip = useCallback(async () => {
    setIsLoadingSample(true);
    try {
      const [sampleHikePayloads, samplePlannedPayload] = await Promise.all([
        loadSampleHikesPayloads(),
        plannedRoutes.length === 0 ? loadSamplePlannedRoutePayload() : Promise.resolve(null),
      ]);

      const addedHikes: Hike[] = [];
      for (const payload of sampleHikePayloads) {
        addedHikes.push(await addLocalHike(payload));
      }

      setHikes((prev) =>
        [...addedHikes, ...prev].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      );

      if (samplePlannedPayload) {
        const samplePlanned = await addLocalPlannedRoute(samplePlannedPayload);
        setPlannedRoutes((prev) => [samplePlanned, ...prev]);
      }

      if (addedHikes[0]) {
        setSelectedTripId(addedHikes[0].id);
      }
      setSelectedMapIndex(null);
      setActiveTab('map');
      setWelcomeDismissed(true);
      await setMetaValue('welcome_dismissed_v1', true);
      showToast(
        'Načteny ukázkové trasy: Králický Sněžník, Lysá hora a plánovaná šumavská hřebenovka přes Plechý!',
        'success'
      );
    } catch (err) {
      console.error('Failed to load sample routes:', err);
      showToast('Nepodařilo se načíst ukázkové trasy.', 'error');
    } finally {
      setIsLoadingSample(false);
    }
  }, [plannedRoutes.length, showToast]);

  const handleDismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    void setMetaValue('welcome_dismissed_v1', true);
  }, []);

  // Handle GPX file upload from Navbar's Záloha a export dat menu
  const handleImportGpx = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPro && hikes.length >= FREE_MAX_HIKES) {
      openAccountModal('license', 'unlimited_hikes');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const gpxString = event.target?.result as string;
      const coords = parseGpxXml(gpxString);
      if (!coords || coords.length === 0) {
        showToast('Soubor GPX neobsahuje žádné body trasy.', 'error');
        return;
      }

      const distKm = calculateCoordsDistanceKm(coords);

      let trackName = file.name.replace(/\.gpx$/i, '');
      const todayIso = new Date().toISOString().slice(0, 10);
      let trackDate = todayIso;

      try {
        const xmlDoc = new DOMParser().parseFromString(gpxString, 'text/xml');
        const nameEl = xmlDoc.querySelector('trk > name, metadata > name, name');
        if (nameEl?.textContent?.trim()) {
          trackName = nameEl.textContent.trim();
        }
        const timeEl = xmlDoc.querySelector('metadata > time, trkpt > time, time');
        if (timeEl?.textContent?.trim()) {
          const parsedTime = timeEl.textContent.trim().slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(parsedTime)) {
            trackDate = parsedTime;
          }
        }
      } catch {
        // ignore metadata parse error
      }

      const routePart: RoutePart = {
        distance: Math.round(distKm * 10) / 10,
        url: '',
        link: '',
        photos: '',
        photosUrl: '',
        video: '',
        youtube: '',
        gpxData: gpxString,
        gpxName: file.name,
        coordinates: coords,
      };

      const saved = await addLocalHike({
        name: trackName,
        distance: distKm,
        date: trackDate,
        routes: [routePart],
      });

      setHikes((prev) =>
        [saved, ...prev].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      );
      setSelectedTripId(saved.id);
      setSelectedMapIndex(null);
      setActiveTab('map');
      showToast('GPX trasa byla uložena do archívu', 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export JSON backup (always available in Free & PRO)
  const handleExportJson = () => {
    if (hikes.length === 0 && plannedRoutes.length === 0) {
      showToast('Zatím nemáte žádné záznamy k exportu.', 'warning');
      return;
    }
    const cleanHikes = hikes.map((h) => ({
      id: h.id,
      name: h.name,
      distance: typeof h.distance === 'string' ? parseFloat(h.distance) || 0 : h.distance,
      date: h.date,
      dateTo: h.dateTo || '',
      participants: h.participants || '',
      note: h.note || '',
      activity: h.activity || '',
      routes: (h.routes || h.maps || []).map((r) => ({
        distance:
          r.distance !== undefined && r.distance !== '' ? parseFloat(String(r.distance)) || 0 : 0,
        link: r.link || r.url || '',
        gpxData: r.gpxData || null,
        gpxName: r.gpxName || '',
        photosUrl: r.photosUrl || r.photos || '',
        youtube: r.youtube || r.video || '',
        coordinates: r.coordinates || [],
      })),
    }));

    const backupBundle = {
      version: '4.1.0-pro',
      app: 'Horský zápisník a Archív tras',
      exportedAt: new Date().toISOString(),
      hikes: cleanHikes,
      plannedRoutes,
      participants: participantProfiles,
    };

    const blob = new Blob([JSON.stringify(backupBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `horsky-zapisnik-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSON záloha byla stažena', 'success');
  };

  // Export Excel (PRO)
  const handleExportExcel = () => {
    if (!isPro) {
      openAccountModal('license', 'exports');
      return;
    }
    if (hikes.length === 0) {
      showToast('Zatím nemáte žádné záznamy k exportu.', 'warning');
      return;
    }
    exportHikesToExcel(hikes, `vyslapy_excel_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('XLSX soubor byl vygenerován', 'success');
  };

  // Import JSON into local IndexedDB (supports both legacy array and full bundle)
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as unknown;
        let rawHikes: unknown[] = [];
        let rawPlanned: unknown[] | null = null;
        let rawParticipants: Record<string, ParticipantProfile> | null = null;

        if (Array.isArray(parsed)) {
          rawHikes = parsed;
        } else if (parsed && typeof parsed === 'object') {
          const obj = parsed as Record<string, unknown>;
          if (Array.isArray(obj.hikes)) rawHikes = obj.hikes;
          if (Array.isArray(obj.plannedRoutes)) rawPlanned = obj.plannedRoutes;
          if (obj.participants && typeof obj.participants === 'object') {
            rawParticipants = obj.participants as Record<string, ParticipantProfile>;
          }
        } else {
          showToast('Soubor neobsahuje platnou zálohu Horského zápisníku.', 'error');
          return;
        }

        if (!isPro && rawHikes.length > FREE_MAX_HIKES) {
          openAccountModal('license', 'unlimited_hikes');
          return;
        }

        setConfirmModal({
          isOpen: true,
          title: 'Nahrát zálohu do zařízení',
          message: `Chystáte se nahrát ${rawHikes.length} výšlapů${
            rawPlanned ? ` a ${rawPlanned.length} plánovaných tras` : ''
          } do lokálního úložiště tohoto zařízení. Stávající záznamy budou nahrazeny. Přejete si pokračovat?`,
          confirmText: 'Ano, importovat',
          isDestructive: true,
          onConfirm: async () => {
            try {
              const normalizedHikes = await normalizeImportedHikes(rawHikes);
              normalizedHikes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              await replaceAllLocalHikes(normalizedHikes);
              setHikes(normalizedHikes);

              if (rawPlanned !== null) {
                const normalizedPlanned = await normalizeImportedPlannedRoutes(rawPlanned);
                await replaceAllLocalPlannedRoutes(normalizedPlanned);
                setPlannedRoutes(normalizedPlanned);
              }
              if (rawParticipants !== null) {
                await replaceAllLocalParticipants(rawParticipants);
                setParticipantProfiles(rawParticipants);
              }

              setSelectedTripId(null);
              showToast(`Úspěšně importováno ${normalizedHikes.length} výšlapů!`, 'success');
            } catch (err: unknown) {
              const errObj = err as Error;
              showToast(`Chyba importu: ${errObj?.message || 'Neznámá chyba'}`, 'error');
            } finally {
              setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            }
          },
        });
      } catch {
        showToast('Nepodařilo se přečíst JSON soubor.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="mobile-9-16-outer">
      <div className="mobile-9-16-frame bg-stone-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
        {/* Full-Screen Logo Loading Screen on App Startup & Before Map Loads */}
        {!splashRemoved && (
          <div
            className={`absolute md:fixed inset-0 z-[9999] bg-[#fbfaf5] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-500 ${
              isAppAndMapLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            aria-label="Načítání aplikace Horský zápisník"
          >
            <div className="w-[90%] aspect-square md:w-[min(94vw,86vh)] md:h-[min(94vw,86vh)] flex items-center justify-center overflow-hidden">
              <img
                src={`${import.meta.env.BASE_URL}assets/aistudio/Gemini_Generated_Image_sdhf1zsdhf1zsdhf_fd6937b9.jpg`}
                alt="Horský zápisník logo"
                className="w-full h-full object-cover scale-[1.06] mix-blend-multiply animate-pulse"
                style={{ animationDuration: '2.8s' }}
              />
            </div>
            <div className="absolute bottom-6 sm:bottom-8 flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-stone-900/5 border border-stone-900/10 text-stone-700 text-xs sm:text-sm font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              <span>Načítání mapy a tras…</span>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((prev) => ({ ...prev, message: null }))}
        />

        {/* Confirmation Dialog */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          isDestructive={confirmModal.isDestructive}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        />

        {/* Account, Google Drive Backup & PRO License Modal */}
        <AccountLicenseModal
          isOpen={accountModal.isOpen}
          initialTab={accountModal.tab}
          lockedFeature={accountModal.lockedFeature}
          onClose={() => setAccountModal((prev) => ({ ...prev, isOpen: false, lockedFeature: null }))}
          licenseState={licenseState}
          billingConfig={billingConfig}
          hikesCount={hikes.length}
          plannedCount={plannedRoutes.length}
          googleUser={googleUser}
          hasActiveDriveToken={hasActiveDriveToken}
          driveBackupInfo={driveBackupInfo}
          isDriveBusy={isDriveBusy}
          isOffline={isOffline}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
          onRefreshDriveStatus={() => refreshDriveBackupStatus()}
          onRequestDriveBackup={handleRequestDriveBackup}
          onRequestDriveRestore={handleRequestDriveRestore}
          onStartTrial={handleStartTrial}
          onActivateLicenseKey={handleActivateLicenseKey}
          onRequestDeactivateLicense={handleRequestDeactivateLicense}
        />

        {/* Offline Mode & Map Download Modal */}
        <OfflineModal
          isOpen={isOfflineModalOpen}
          onClose={() => setIsOfflineModalOpen(false)}
          isOnline={isOnline}
          isManualOffline={isManualOffline}
          onToggleManualOffline={handleToggleManualOffline}
          isDriveConnected={isDriveConnected}
          isPro={isPro}
          hikes={hikes}
          plannedRoutes={plannedRoutes}
          selectedTrip={hikes.find((h) => h.id === selectedTripId) || null}
          selectedPlannedRoute={
            plannedRoutes.find((r) => r.id === selectedPlannedRouteId) || null
          }
          onOpenAccountModal={openAccountModal}
          onNotify={showToast}
        />

        {/* Non-intrusive Offline Status Banner */}
        <OfflineIndicator
          isOnline={isOnline}
          isManualOffline={isManualOffline}
          pendingCount={0}
          isSyncing={false}
          onClick={() => setIsOfflineModalOpen(true)}
        />

        {/* Printable Report View (Full Page) */}
        {activeTab === 'print' ? (
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-visible">
            <PrintReportView
              hikes={hikes}
              filterState={filterState}
              onFilterChange={(newFilters) =>
                setFilterState((prev) => ({ ...prev, ...newFilters }))
              }
              onBack={() => setActiveTab('map')}
              onNotify={showToast}
            />
          </div>
        ) : (
          <>
            {/* Top Navbar */}
            <Navbar
              activeTab={activeTab}
              setActiveTab={handleSelectTab}
              isDriveConnected={isDriveConnected}
              isOffline={isOffline}
              isManualOffline={isManualOffline}
              isPro={isPro}
              licenseTier={licenseState.tier}
              trialDaysLeft={trialDaysLeft}
              onOpenOfflineModal={() => setIsOfflineModalOpen(true)}
              onOpenAccountModal={openAccountModal}
              totalDistance={totalDistance}
              totalTrips={totalTrips}
              onNewHikeClick={() => {
                setEditingHike(null);
                setActiveTab('journal');
              }}
              onExportJson={handleExportJson}
              onExportExcel={handleExportExcel}
              onImportJson={handleImportJson}
              onImportGpx={handleImportGpx}
            />

            {/* Hidden GPX input for Welcome Onboarding banner */}
            <input
              type="file"
              ref={onboardingGpxInputRef}
              accept=".gpx"
              className="hidden"
              onChange={handleImportGpx}
            />

            {/* New-User Welcome Onboarding Banner (only when archive is empty) */}
            {isInitialDataLoaded &&
              hikes.length === 0 &&
              !welcomeDismissed &&
              (activeTab === 'map' || activeTab === 'journal') && (
                <WelcomeOnboardingBanner
                  onLoadSampleTrip={handleLoadSampleTrip}
                  onOpenNewHike={() => {
                    setEditingHike(null);
                    setActiveTab('journal');
                  }}
                  onTriggerGpxUpload={() => onboardingGpxInputRef.current?.click()}
                  onDismiss={handleDismissWelcome}
                  isLoadingSample={isLoadingSample}
                />
              )}

            {/* Main Views Container */}
            <main className="flex-1 min-h-0 flex flex-col overflow-y-auto md:block md:overflow-visible">
              {/* TAB 1: Zápisník (Journal) */}
              {activeTab === 'journal' && (
                <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-7">
                  <HikeForm
                    editingHike={editingHike}
                    onSave={handleSaveHike}
                    onCancelEdit={() => setEditingHike(null)}
                  />

                  <HikeList
                    hikes={hikes}
                    filterState={filterState}
                    onFilterChange={(newFilters) =>
                      setFilterState((prev) => ({ ...prev, ...newFilters }))
                    }
                    onEdit={(hike) => setEditingHike(hike)}
                    onDelete={handleDeleteHike}
                    onShowOnMap={handleShowOnMap}
                    onShowAnalytics={handleShowAnalytics}
                  />
                </div>
              )}

              {/* TAB 2: Interaktivní mapa (Map) */}
              {activeTab === 'map' && (
                <MapView
                  hikes={hikes}
                  filterState={filterState}
                  onFilterChange={(newFilters) =>
                    setFilterState((prev) => ({ ...prev, ...newFilters }))
                  }
                  selectedTripId={selectedTripId}
                  selectedMapIndex={selectedMapIndex}
                  onSelectTrip={(id, mIdx = null) => {
                    setSelectedTripId(id);
                    setSelectedMapIndex(mIdx !== undefined ? mIdx : null);
                  }}
                  onOpenAnalytics={(id) => {
                    if (id) setSelectedTripId(id);
                    setActiveTab('analytics');
                  }}
                  onOpen3D={() => handleSelectTab('route3d')}
                  onOpenPrint={() => handleSelectTab('print')}
                  onRefreshCloud={handleRefreshCloud}
                  onMapReady={() => setIsMapReady(true)}
                />
              )}

              {/* SKRYTÁ SEKCE: 3D zobrazení vybrané trasy */}
              {activeTab === 'route3d' && (
                <Route3DView
                  trip={hikes.find((h) => h.id === selectedTripId) || null}
                  selectedMapIndex={selectedMapIndex}
                  onSelectSegment={(mIdx) => setSelectedMapIndex(mIdx)}
                  onBackTo2D={() => setActiveTab('map')}
                  onOpenAnalytics={(id) => {
                    if (id) setSelectedTripId(id);
                    setActiveTab('analytics');
                  }}
                />
              )}

              {/* TAB 3: Analytika (Analytics) */}
              {activeTab === 'analytics' && (
                <AnalyticsView
                  hikes={hikes}
                  initialTripId={selectedTripId}
                  onSelectTripOnMap={(id) => {
                    setSelectedTripId(id);
                    setSelectedMapIndex(null);
                    setActiveTab('map');
                  }}
                />
              )}

              {/* TAB 4: Milníky (Milestones) */}
              {activeTab === 'milestones' && (
                <MilestonesView
                  hikes={hikes}
                  onSelectTripOnMap={(id) => {
                    setSelectedTripId(id);
                    setSelectedMapIndex(null);
                    setActiveTab('map');
                  }}
                />
              )}

              {/* TAB 5: Plánované trasy (Planned Routes) */}
              {activeTab === 'planned' && (
                <PlannedRoutesView
                  plannedRoutes={plannedRoutes}
                  selectedRouteId={selectedPlannedRouteId}
                  onSelectRoute={setSelectedPlannedRouteId}
                  onOpen3D={() => handleSelectTab('planned3d')}
                  onSavePlannedRoute={handleSavePlannedRoute}
                  onDeletePlannedRoute={(id) => {
                    if (selectedPlannedRouteId === id) setSelectedPlannedRouteId(null);
                    handleDeletePlannedRoute(id);
                  }}
                />
              )}

              {/* SKRYTÁ SEKCE: 3D zobrazení vybrané plánované trasy */}
              {activeTab === 'planned3d' && (
                <Route3DView
                  plannedRoute={
                    plannedRoutes.find((r) => r.id === selectedPlannedRouteId) || null
                  }
                  plannedColor={(() => {
                    const idx = plannedRoutes.findIndex((r) => r.id === selectedPlannedRouteId);
                    const found = idx >= 0 ? plannedRoutes[idx] : null;
                    return (
                      found?.color ||
                      DISTINCT_ROUTE_COLORS[Math.max(0, idx) % DISTINCT_ROUTE_COLORS.length]
                    );
                  })()}
                  onBackTo2D={() => setActiveTab('planned')}
                />
              )}

              {/* TAB 6: Účastníci (Participants & Milestone Email Notifications) */}
              {activeTab === 'participants' && (
                <ParticipantsView
                  hikes={hikes}
                  participantProfiles={participantProfiles}
                  onSaveProfile={handleSaveParticipantProfile}
                  onNotify={showToast}
                />
              )}

              {/* TAB 7: Zázemí na trase (Accommodation, food, parking) */}
              {activeTab === 'accommodation' && (
                <AccommodationView
                  hikes={hikes}
                  plannedRoutes={plannedRoutes}
                  onNotify={showToast}
                />
              )}
            </main>
          </>
        )}
      </div>
    </div>
  );
}
