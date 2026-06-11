import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  writeBatch,
  documentId,
  runTransaction
} from 'firebase/firestore';
import { UserProfile, Match, Prediction, Group, PredictionSheet, PredictionSnapshot } from '../types';
import { generateGroupStageMatches, MATCHES_SEED_VERSION } from '../utils/seeds/matchesSeed';
import { calculatePoints } from '../utils/points';

/**
 * Creates a new user profile in Firestore.
 * If this is the first user registering in the database,
 * their role will automatically be set to 'admin'.
 */
export async function createUserProfile(
  uid: string,
  displayName: string,
  email: string
): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const existingProfile = userSnap.data() as UserProfile;
    const normalizedDisplayName = displayName.trim();

    if (
      normalizedDisplayName &&
      normalizedDisplayName !== 'Usuário Copa' &&
      normalizedDisplayName !== existingProfile.displayName
    ) {
      await updateDoc(userRef, { displayName: normalizedDisplayName });
      return { ...existingProfile, displayName: normalizedDisplayName };
    }

    return existingProfile;
  }

  // Check if this is the first user in the database to assign 'admin' role
  const usersCol = collection(db, 'users');
  const checkQuery = query(usersCol, limit(1));
  const checkSnap = await getDocs(checkQuery);
  const isFirstUser = checkSnap.empty;

  const profile: UserProfile = {
    id: uid,
    displayName: displayName || 'Anonymous User',
    email: email || '',
    role: isFirstUser ? 'admin' : 'user',
    totalPoints: 0,
    stats: {
      exactScores: 0,
      correctResults: 0,
    },
  };

  await setDoc(userRef, profile);
  return profile;
}

/**
 * Checks if the "matches" collection is empty, and seeds it with the
 * 72 programmatically generated matches if it is.
 */
/**
 * Checks if the "matches" document is empty, and seeds it with the
 * 72 programmatically generated matches if it is.
 */
export async function checkAndSeedMatches(): Promise<void> {
  const docRef = doc(db, 'matches', 'all_matches');
  const docSnap = await getDoc(docRef);

  const data = docSnap.data();
  const list = data?.list as Match[] | undefined;
  const statuses = data?.statuses as Record<string, Match["status"]> | undefined;
  const hasCompleteStatuses =
    list?.length === 72 &&
    statuses != null &&
    list.every((match) => statuses[match.id] === match.status);
  const needsSeed =
    !docSnap.exists() ||
    data?.seedVersion !== MATCHES_SEED_VERSION ||
    !hasCompleteStatuses;

  if (needsSeed) {
    const matches = generateGroupStageMatches();
    const statuses: Record<string, string> = {};
    matches.forEach((m) => {
      statuses[m.id] = m.status;
    });
    await setDoc(docRef, {
      list: matches,
      statuses,
      seedVersion: MATCHES_SEED_VERSION
    });
    console.log(`Seeded matches single-document with ${matches.length} Portuguese matches and statuses map.`);
  }
}

/**
 * Fetches all matches from the single Firestore document.
 */
export async function getMatches(): Promise<Match[]> {
  const docRef = doc(db, 'matches', 'all_matches');
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const list = (data.list as Match[]) || [];
    // Sort matches by date
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return [];
}

/**
 * Updates a specific match inside the single matches document.
 */
export async function updateMatchInSingleDoc(matchId: string, updates: Partial<Match>): Promise<void> {
  const docRef = doc(db, 'matches', 'all_matches');
  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(docRef);
    if (!docSnap.exists()) {
      throw new Error('Documento de partidas não encontrado.');
    }

    const data = docSnap.data();
    const list = (data.list as Match[]) || [];
    if (!list.some((match) => match.id === matchId)) {
      throw new Error('Partida não encontrada.');
    }

    const statuses = {
      ...((data.statuses as Record<string, Match['status']>) || {})
    };
    const updatedList = list.map((match) =>
      match.id === matchId ? { ...match, ...updates } : match
    );

    if (updates.status) {
      statuses[matchId] = updates.status;
    }

    transaction.set(docRef, {
      ...data,
      list: updatedList,
      statuses
    });
  });
}

async function transitionMatchStatus(
  matchId: string,
  allowedStatuses: Match['status'][],
  updates: Partial<Match>
): Promise<void> {
  const docRef = doc(db, 'matches', 'all_matches');
  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(docRef);
    if (!docSnap.exists()) {
      throw new Error('Documento de partidas não encontrado.');
    }

    const data = docSnap.data();
    const list = (data.list as Match[]) || [];
    const currentMatch = list.find((match) => match.id === matchId);
    if (!currentMatch) {
      throw new Error('Partida não encontrada.');
    }
    if (!allowedStatuses.includes(currentMatch.status)) {
      throw new Error('Transição inválida para partida com status ' + currentMatch.status + '.');
    }

    const statuses = {
      ...((data.statuses as Record<string, Match['status']>) || {})
    };
    const updatedMatch = { ...currentMatch, ...updates };
    statuses[matchId] = updatedMatch.status;

    transaction.set(docRef, {
      ...data,
      list: list.map((match) => match.id === matchId ? updatedMatch : match),
      statuses
    });
  });
}

/**
 * Appends a new knockout stage match to the single matches document.
 */
export async function createKnockoutMatchInSingleDoc(newMatch: Match): Promise<void> {
  const docRef = doc(db, 'matches', 'all_matches');
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const list = (data.list as Match[]) || [];
    const statuses = (data.statuses as Record<string, string>) || {};

    // Append the new match if it doesn't exist yet
    if (!list.some(m => m.id === newMatch.id)) {
      statuses[newMatch.id] = newMatch.status;
      await setDoc(docRef, {
        ...data,
        list: [...list, newMatch],
        statuses
      });
    }
  }
}

/**
 * Saves or updates a user's score prediction for a given match.
 */
export async function savePrediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
  locked?: boolean
): Promise<void> {
  const predictionId = userId + '_' + matchId;
  const batch = writeBatch(db);
  const sheetRef = doc(db, 'prediction_sheets', userId);
  const newPrediction: Prediction = {
    id: predictionId,
    userId,
    matchId,
    homeScore,
    awayScore,
    locked: locked === true,
  };

  batch.set(sheetRef, {
    userId,
    version: 1,
    predictions: {
      [matchId]: newPrediction
    },
    lastUpdatedMatchId: matchId
  }, { merge: true });

  if (locked) {
    const lockedRef = doc(db, 'locked_predictions', predictionId);
    batch.set(lockedRef, newPrediction);
  }

  await batch.commit();
}

const userProfileCache = new Map<string, UserProfile>();

export async function getUserProfiles(userIds: string[]): Promise<UserProfile[]> {
  const uniqueIds = Array.from(new Set(userIds));
  const missingIds = uniqueIds.filter((userId) => !userProfileCache.has(userId));

  for (let index = 0; index < missingIds.length; index += 25) {
    const batchIds = missingIds.slice(index, index + 25);
    const snapshot = await getDocs(
      query(collection(db, "users"), where(documentId(), "in", batchIds))
    );
    snapshot.docs.forEach((document) => {
      userProfileCache.set(document.id, document.data() as UserProfile);
    });
  }

  return uniqueIds.flatMap((userId) => {
    const profile = userProfileCache.get(userId);
    return profile ? [profile] : [];
  });
}

export async function getVisiblePredictionsForMatch(
  matchId: string,
  userIds: string[],
  lockedOnly: boolean,
  matchStatus?: string
): Promise<Prediction[]> {
  const uniqueIds = Array.from(new Set(userIds));
  const results: Prediction[] = [];

  // Case A: Match is scheduled (lockedOnly = true)
  if (lockedOnly || matchStatus === 'scheduled') {
    const lockedCollection = collection(db, 'locked_predictions');
    const predictionIds = uniqueIds.map((userId) => userId + '_' + matchId);

    for (let index = 0; index < predictionIds.length; index += 25) {
      const batchIds = predictionIds.slice(index, index + 25);
      const lockedQuery = query(lockedCollection, where(documentId(), 'in', batchIds));
      try {
        const snapshot = await getDocs(lockedQuery);
        results.push(...snapshot.docs.map((docSnap) => docSnap.data() as Prediction));
      } catch (err) {
        console.warn('Failed reading batch from locked_predictions:', err);
      }
    }

    const foundIds = new Set(results.map((prediction) => prediction.id));
    const missingIds = predictionIds.filter((predictionId) => !foundIds.has(predictionId));
    const legacyCollection = collection(db, 'predictions');

    for (let index = 0; index < missingIds.length; index += 25) {
      const batchIds = missingIds.slice(index, index + 25);
      const legacyQuery = query(
        legacyCollection,
        where(documentId(), 'in', batchIds),
        where('locked', '==', true)
      );
      try {
        const snapshot = await getDocs(legacyQuery);
        results.push(...snapshot.docs.map((docSnap) => docSnap.data() as Prediction));
      } catch (err) {
        console.warn('Failed reading locked legacy predictions:', err);
      }
    }

    return results;
  }

  // Case B: Match is live or finished (after kickoff)
  try {
    const snapRef = doc(db, 'prediction_snapshots', matchId);
    const snapDoc = await getDoc(snapRef);
    if (snapDoc.exists()) {
      const data = snapDoc.data() as PredictionSnapshot;
      if (data && data.predictions) {
        uniqueIds.forEach((friendId) => {
          if (data.predictions[friendId]) {
            const friendPred = data.predictions[friendId];
            results.push({
              id: `${friendId}_${matchId}`,
              userId: friendId,
              matchId,
              homeScore: friendPred.homeScore,
              awayScore: friendPred.awayScore,
              locked: true
            });
          }
        });
      }
      return results;
    }
  } catch (err) {
    console.warn('Failed reading match snapshot, trying legacy predictions fallback:', err);
  }

  // Fallback Case: read from predictions (legacy)
  const predictionsCollection = collection(db, "predictions");
  const predictionIds = uniqueIds.map((userId) => `${userId}_${matchId}`);
  for (let index = 0; index < predictionIds.length; index += 25) {
    const batchIds = predictionIds.slice(index, index + 25);
    const predictionsQuery = lockedOnly
      ? query(
          predictionsCollection,
          where(documentId(), "in", batchIds),
          where("locked", "==", true)
        )
      : query(predictionsCollection, where(documentId(), "in", batchIds));
    try {
      const snapshot = await getDocs(predictionsQuery);
      results.push(
        ...snapshot.docs.map((document) => document.data() as Prediction)
      );
    } catch (err) {
      console.warn('Failed reading batch legacy predictions:', err);
    }
  }

  return results;
}

async function migrateLegacyPredictions(
  userId: string,
  legacyRecords: Record<string, Prediction>
): Promise<void> {
  const sheetRef = doc(db, 'prediction_sheets', userId);

  for (const [matchId, prediction] of Object.entries(legacyRecords)) {
    await runTransaction(db, async (transaction) => {
      const sheetSnapshot = await transaction.get(sheetRef);
      const sheet = sheetSnapshot.exists()
        ? sheetSnapshot.data() as PredictionSheet
        : null;

      if (sheet?.predictions?.[matchId]) {
        return;
      }

      transaction.set(sheetRef, {
        userId,
        version: 1,
        predictions: { [matchId]: prediction },
        migrationComplete: false,
        lastUpdatedMatchId: matchId
      }, { merge: true });
    });
  }

  await runTransaction(db, async (transaction) => {
    const sheetSnapshot = await transaction.get(sheetRef);
    if (sheetSnapshot.exists()) {
      transaction.set(sheetRef, { migrationComplete: true }, { merge: true });
      return;
    }

    transaction.set(sheetRef, {
      userId,
      version: 1,
      predictions: {},
      migrationComplete: true
    });
  });
}

/**
 * Fetches all predictions made by a user and returns them as a Record
 * keyed by the matchId.
 */
export async function getUserPredictions(userId: string): Promise<Record<string, Prediction>> {
  let existingSheet: PredictionSheet | null = null;

  try {
    const sheetRef = doc(db, 'prediction_sheets', userId);
    const sheetSnap = await getDoc(sheetRef);

    if (sheetSnap.exists()) {
      const data = sheetSnap.data() as PredictionSheet;
      if (data.version === 1) {
        existingSheet = data;
        if (data.migrationComplete === true) {
          return data.predictions || {};
        }
      }
    }
  } catch (err) {
    console.error('Error reading prediction_sheets, falling back to legacy path:', err);
  }

  const predictionsCol = collection(db, 'predictions');
  const legacyQuery = query(predictionsCol, where('userId', '==', userId));
  const legacySnapshot = await getDocs(legacyQuery);

  const legacyRecords: Record<string, Prediction> = {};
  legacySnapshot.docs.forEach((docSnap) => {
    const pred = docSnap.data() as Prediction;
    legacyRecords[pred.matchId] = {
      id: userId + '_' + pred.matchId,
      userId,
      matchId: pred.matchId,
      homeScore: pred.homeScore,
      awayScore: pred.awayScore,
      locked: pred.locked === true
    };
  });

  const mergedRecords = {
    ...legacyRecords,
    ...(existingSheet?.predictions || {})
  };

  void migrateLegacyPredictions(userId, legacyRecords).catch((migrationErr) => {
    console.warn('Prediction sheet migration will be retried on the next load:', migrationErr);
  });

  return mergedRecords;
}

/**
 * Creates an immutable snapshot of all user predictions for a given match.
 * Scans both prediction_sheets and legacy predictions, merges them,
 * and writes to prediction_snapshots/{matchId}.
 * The first successfully created snapshot is preserved on every retry.
 */
export async function createMatchSnapshot(matchId: string): Promise<void> {
  const sheetsCol = collection(db, 'prediction_sheets');
  const sheetsSnap = await getDocs(sheetsCol);

  const predictionsCol = collection(db, 'predictions');
  const legacyQuery = query(predictionsCol, where('matchId', '==', matchId));
  const legacySnap = await getDocs(legacyQuery);

  const snapshotPredictions: Record<string, { homeScore: number; awayScore: number }> = {};

  // Process legacy predictions (include unlocked drafts as well, as kickoff has happened)
  legacySnap.docs.forEach((docSnap) => {
    const pred = docSnap.data() as Prediction;
    if (pred && pred.homeScore !== undefined && pred.awayScore !== undefined) {
      snapshotPredictions[pred.userId] = {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore
      };
    }
  });

  // Process prediction sheets (precedence, include drafts)
  sheetsSnap.docs.forEach((docSnap) => {
    const sheet = docSnap.data() as PredictionSheet;
    if (sheet && sheet.predictions && sheet.predictions[matchId]) {
      const pred = sheet.predictions[matchId];
      if (pred && pred.homeScore !== undefined && pred.awayScore !== undefined) {
        snapshotPredictions[sheet.userId] = {
          homeScore: pred.homeScore,
          awayScore: pred.awayScore
        };
      }
    }
  });

  // Process locked_predictions (filtered by matchId)
  const lockedCol = collection(db, 'locked_predictions');
  const lockedQuery = query(lockedCol, where('matchId', '==', matchId));
  const lockedSnap = await getDocs(lockedQuery);
  lockedSnap.docs.forEach((docSnap) => {
    const pred = docSnap.data() as Prediction;
    if (pred && pred.homeScore !== undefined && pred.awayScore !== undefined) {
      snapshotPredictions[pred.userId] = {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore
      };
    }
  });

  const snapshotRef = doc(db, 'prediction_snapshots', matchId);
  const created = await runTransaction(db, async (transaction) => {
    const existingSnapshot = await transaction.get(snapshotRef);
    if (existingSnapshot.exists()) {
      return false;
    }

    transaction.set(snapshotRef, {
      matchId,
      createdAt: new Date().toISOString(),
      predictions: snapshotPredictions,
      version: 1
    });
    return true;
  });

  if (created) {
    console.log('Created match snapshot for ' + matchId + ' with ' + Object.keys(snapshotPredictions).length + ' predictions.');
  }
}

export async function startMatchWithSnapshot(matchId: string): Promise<void> {
  await transitionMatchStatus(matchId, ['scheduled', 'locking'], {
    status: 'locking'
  });

  await createMatchSnapshot(matchId);

  await transitionMatchStatus(matchId, ['locking'], {
    status: 'live',
    homeScore: 0,
    awayScore: 0
  });
}

export async function finalizeMatchAndRecalculate(matchId: string): Promise<void> {
  // Supports live matches that started before snapshots were introduced.
  await createMatchSnapshot(matchId);
  await transitionMatchStatus(matchId, ['live', 'finished'], {
    status: 'finished'
  });
  await recalculateAllUserPoints();
}

/**
 * Recalculates and updates totalPoints and stats (exactScores, correctResults)
 * for all users based on all finished matches.
 * Should be run when a match is finalized.
 */
export async function recalculateAllUserPoints(): Promise<void> {
  const usersCol = collection(db, 'users');
  const usersSnap = await getDocs(usersCol);
  const users = usersSnap.docs.map(d => d.data() as UserProfile);

  const allMatches = await getMatches();
  const finishedMatches = allMatches.filter(m => m.status === 'finished');

  // Load all snapshots in parallel
  const snapshots: Record<string, Record<string, { homeScore: number; awayScore: number }>> = {};
  await Promise.all(
    finishedMatches.map(async (match) => {
      try {
        const snapRef = doc(db, 'prediction_snapshots', match.id);
        const snapDoc = await getDoc(snapRef);
        if (snapDoc.exists()) {
          const data = snapDoc.data() as PredictionSnapshot;
          if (data && data.predictions) {
            snapshots[match.id] = data.predictions;
          }
        }
      } catch (err) {
        console.warn(`Could not read snapshot for match ${match.id} during points recalculation:`, err);
      }
    })
  );

  const missingSnapshotIds = finishedMatches
    .filter((match) => !snapshots[match.id])
    .map((match) => match.id);
  if (missingSnapshotIds.length > 0) {
    throw new Error('Snapshots ausentes para partidas finalizadas: ' + missingSnapshotIds.join(', '));
  }

  let batch = writeBatch(db);
  let counter = 0;

  for (const user of users) {
    let totalPoints = 0;
    let exactScores = 0;
    let correctResults = 0;

    finishedMatches.forEach((match) => {
      const pred = snapshots[match.id][user.id];

      const homeScore = match.homeScore;
      const awayScore = match.awayScore;

      if (
        pred &&
        homeScore !== undefined &&
        awayScore !== undefined &&
        homeScore !== null &&
        awayScore !== null
      ) {
        const points = calculatePoints(
          pred.homeScore,
          pred.awayScore,
          homeScore,
          awayScore
        );
        totalPoints += points;

        if (points === 5) {
          exactScores += 1;
        } else if (points >= 2) {
          correctResults += 1;
        }
      }
    });

    const userRef = doc(db, 'users', user.id);
    batch.update(userRef, {
      totalPoints,
      stats: {
        exactScores,
        correctResults
      }
    });

    counter++;
    if (counter === 500) {
      await batch.commit();
      batch = writeBatch(db);
      counter = 0;
    }
  }

  if (counter > 0) {
    await batch.commit();
  }

  console.log(`Recalculated points and stats for ${users.length} users in chunks.`);
}

/**
 * Helper to generate a random 6-character uppercase alphanumeric invite code.
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a new prediction group in Firestore, generating a unique code
 * and adding the creator as the first member.
 */
export async function createGroup(name: string, creatorId: string): Promise<Group> {
  const inviteCode = generateInviteCode();
  const groupsCol = collection(db, 'groups');
  const groupDocRef = doc(groupsCol); // Auto-generated ID

  const group: Group = {
    id: groupDocRef.id,
    name,
    creatorId,
    inviteCode,
    members: [creatorId],
  };

  await setDoc(groupDocRef, group);
  return group;
}

/**
 * Adds a user to an existing group using the invite code.
 * Throws an error if the group is not found.
 */
export async function joinGroup(inviteCode: string, userId: string): Promise<Group> {
  const groupsCol = collection(db, 'groups');
  const q = query(groupsCol, where('inviteCode', '==', inviteCode.toUpperCase().trim()));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('Group not found');
  }

  const groupDoc = snap.docs[0];
  const group = groupDoc.data() as Group;

  if (!group.members.includes(userId)) {
    const updatedMembers = [...group.members, userId];
    await updateDoc(groupDoc.ref, { members: updatedMembers });
    group.members = updatedMembers;
  }

  return group;
}

/**
 * Fetches all groups that the user is a member of.
 */
export async function getUserGroups(userId: string): Promise<Group[]> {
  const groupsCol = collection(db, 'groups');
  const q = query(groupsCol, where('members', 'array-contains', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Group);
}

/**
 * Fetches user profiles of all members in a given group.
 */
export async function getGroupMembers(groupId: string): Promise<UserProfile[]> {
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);

  if (!groupSnap.exists()) {
    throw new Error('Group not found');
  }

  const group = groupSnap.data() as Group;
  if (!group.members || group.members.length === 0) {
    return [];
  }

  // Fetch all user profiles in parallel
  const memberPromises = group.members.map(async (uid) => {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? (userSnap.data() as UserProfile) : null;
  });

  const members = await Promise.all(memberPromises);
  return members.filter((m): m is UserProfile => m !== null);
}

/**
 * Fetches and sorts the leaderboard. If groupId is provided, it filters
 * for members of that group.
 * If there are active matches in 'live' status, it calculates temporary
 * live points for those matches and adds them to user points before sorting.
 */
export async function getLeaderboard(groupId?: string): Promise<UserProfile[]> {
  const usersPromise = groupId
    ? getGroupMembers(groupId)
    : getDocs(collection(db, "users")).then((snapshot) =>
        snapshot.docs.map((document) => document.data() as UserProfile)
      );

  // Member profiles and matches are independent, so fetch them together.
  const [users, allMatches] = await Promise.all([usersPromise, getMatches()]);

  const liveMatches = allMatches.filter((m) => m.status === 'live');

  // If there are no live matches, simply sort by static points
  if (liveMatches.length === 0) {
    return users.sort((a, b) => b.totalPoints - a.totalPoints);
  }

  // Calculate live points for each user
  const userLivePoints: Record<string, number> = {};
  users.forEach((u) => {
    userLivePoints[u.id] = 0;
  });

  // Fetch predictions for active live matches via snapshots in parallel, with legacy fallback
  await Promise.all(
    liveMatches.map(async (match) => {
      let matchPredictions: Record<string, { homeScore: number; awayScore: number }> = {};
      let snapshotFound = false;

      try {
        const snapRef = doc(db, 'prediction_snapshots', match.id);
        const snapDoc = await getDoc(snapRef);
        if (snapDoc.exists()) {
          const data = snapDoc.data() as PredictionSnapshot;
          if (data && data.predictions) {
            matchPredictions = data.predictions;
            snapshotFound = true;
          }
        }
      } catch (err) {
        console.warn(`Failed reading snapshot for live match ${match.id}, falling back to legacy predictions:`, err);
      }

      if (!snapshotFound) {
        // Fallback to legacy predictions query for this match
        try {
          const predictionsCol = collection(db, 'predictions');
          const q = query(predictionsCol, where('matchId', '==', match.id));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            const pred = d.data() as Prediction;
            if (pred && pred.userId) {
              matchPredictions[pred.userId] = {
                homeScore: pred.homeScore,
                awayScore: pred.awayScore
              };
            }
          });
        } catch (fallbackErr) {
          console.error(`Failed fallback query for match ${match.id}:`, fallbackErr);
        }
      }

      // Calculate temporary live points for each user based on this live match's current score
      const homeScore = match.homeScore;
      const awayScore = match.awayScore;
      if (
        homeScore !== undefined &&
        awayScore !== undefined &&
        homeScore !== null &&
        awayScore !== null
      ) {
        users.forEach((user) => {
          const pred = matchPredictions[user.id];
          if (pred) {
            const points = calculatePoints(
              pred.homeScore,
              pred.awayScore,
              homeScore,
              awayScore
            );
            userLivePoints[user.id] += points;
          }
        });
      }
    })
  );

  // Add live points to totalPoints and sort
  const liveLeaderboard = users.map((user) => ({
    ...user,
    totalPoints: user.totalPoints + (userLivePoints[user.id] || 0),
    livePoints: userLivePoints[user.id] || 0,
  }));

  return liveLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
}
