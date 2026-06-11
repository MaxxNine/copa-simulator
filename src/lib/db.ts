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
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { UserProfile, Match, Prediction, Group } from '../types';
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
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    const list = (data.list as Match[]) || [];
    const statuses = (data.statuses as Record<string, string>) || {};
    
    const updatedList = list.map(m => 
      m.id === matchId ? { ...m, ...updates } : m
    );
    
    if (updates.status) {
      statuses[matchId] = updates.status;
    }
    
    await setDoc(docRef, { 
      ...data,
      list: updatedList, 
      statuses 
    });
  }
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
  const predictionId = `${userId}_${matchId}`;
  const predictionRef = doc(db, 'predictions', predictionId);

  const prediction: Prediction = {
    id: predictionId,
    userId,
    matchId,
    homeScore,
    awayScore,
  };

  if (locked !== undefined) {
    prediction.locked = locked;
  }

  await setDoc(predictionRef, prediction, { merge: true });
}

/**
 * Fetches a single prediction for a friend. Returns null if permission is denied.
 */
export async function getFriendPredictionForMatch(
  friendId: string,
  matchId: string
): Promise<Prediction | null> {
  const predictionId = `${friendId}_${matchId}`;
  const predictionRef = doc(db, 'predictions', predictionId);
  try {
    const snap = await getDoc(predictionRef);
    if (snap.exists()) {
      return snap.data() as Prediction;
    }
  } catch (err) {
    // Gracefully catch permission errors when the prediction is not locked
    // or the current user hasn't locked theirs yet
  }
  return null;
}

/**
 * Fetches all predictions made by a user and returns them as a Record
 * keyed by the matchId.
 */
export async function getUserPredictions(userId: string): Promise<Record<string, Prediction>> {
  const predictionsCol = collection(db, 'predictions');
  const q = query(predictionsCol, where('userId', '==', userId));
  const snap = await getDocs(q);

  const records: Record<string, Prediction> = {};
  snap.docs.forEach((docSnap) => {
    const pred = docSnap.data() as Prediction;
    records[pred.matchId] = pred;
  });

  return records;
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
  // 1. Fetch relevant users
  let users: UserProfile[] = [];
  if (groupId) {
    users = await getGroupMembers(groupId);
  } else {
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(usersCol);
    users = usersSnap.docs.map((d) => d.data() as UserProfile);
  }

  // 2. Fetch live matches to calculate potential live points
  const allMatches = await getMatches();
  const liveMatches = allMatches.filter((m) => m.status === 'live');

  // If there are no live matches, simply sort by static points
  if (liveMatches.length === 0) {
    return users.sort((a, b) => b.totalPoints - a.totalPoints);
  }

  // 3. Fetch predictions for active live matches
  const liveMatchIds = liveMatches.map((m) => m.id);
  let livePredictions: Prediction[] = [];

  if (liveMatchIds.length > 0) {
    const predictionsCol = collection(db, 'predictions');
    const q = query(predictionsCol, where('matchId', 'in', liveMatchIds));
    const snap = await getDocs(q);
    livePredictions = snap.docs.map((d) => d.data() as Prediction);
  }

  // 4. Calculate live points for each user
  const userLivePoints: Record<string, number> = {};
  users.forEach((u) => {
    userLivePoints[u.id] = 0;
  });

  livePredictions.forEach((pred) => {
    const match = liveMatches.find((m) => m.id === pred.matchId);
    if (
      match &&
      match.homeScore !== undefined &&
      match.awayScore !== undefined &&
      match.homeScore !== null &&
      match.awayScore !== null
    ) {
      const points = calculatePoints(
        pred.homeScore,
        pred.awayScore,
        match.homeScore,
        match.awayScore
      );
      if (userLivePoints[pred.userId] !== undefined) {
        userLivePoints[pred.userId] += points;
      }
    }
  });

  // 5. Add live points to totalPoints and sort
  const liveLeaderboard = users.map((user) => ({
    ...user,
    totalPoints: user.totalPoints + (userLivePoints[user.id] || 0),
    livePoints: userLivePoints[user.id] || 0,
  }));

  return liveLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
}
