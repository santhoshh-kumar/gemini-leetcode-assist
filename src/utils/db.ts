import { openDB, DBSchema } from "idb";
import { Chat } from "../state/slices/chatSlice";

interface LeetCodeAssistantDB extends DBSchema {
  chats: {
    key: string;
    value: Chat[];
  };
  "saved-responses": {
    key: string;
    value: string[];
  };
}

let dbPromise: Promise<import("idb").IDBPDatabase<LeetCodeAssistantDB>> | null =
  null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<LeetCodeAssistantDB>("leetcode-assistant", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("chats");
        }
        if (oldVersion < 2) {
          db.createObjectStore("saved-responses");
        }
      },
    });
  }
  return dbPromise;
};

// A map to queue save operations per problem slug, preventing race conditions.
const saveChatQueue = new Map<string, Promise<void>>();

export const saveChat = (
  problemSlug: string,
  chatId: string,
  messages: Chat["messages"],
  lastUpdated?: number,
): Promise<void> => {
  const lastOperation = saveChatQueue.get(problemSlug) || Promise.resolve();

  const newOperation = lastOperation.then(async () => {
    const db = await getDB();
    const tx = db.transaction("chats", "readwrite");
    const store = tx.objectStore("chats");
    const allChatsForProblem = (await store.get(problemSlug)) || [];
    const chatIndex = allChatsForProblem.findIndex(
      (chat) => chat.id === chatId,
    );

    if (chatIndex > -1) {
      allChatsForProblem[chatIndex].messages = messages;
      allChatsForProblem[chatIndex].lastUpdated = lastUpdated ?? Date.now();
    } else {
      allChatsForProblem.push({
        id: chatId,
        messages,
        lastUpdated: lastUpdated ?? Date.now(),
      });
    }

    store.put(allChatsForProblem, problemSlug);
    await tx.done;
  });

  saveChatQueue.set(problemSlug, newOperation);

  // When the operation is done, if it's the last one for this slug, remove it.
  newOperation.finally(() => {
    if (saveChatQueue.get(problemSlug) === newOperation) {
      saveChatQueue.delete(problemSlug);
    }
  });

  return newOperation;
};

export const loadChats = async (problemSlug: string): Promise<Chat[]> => {
  const db = await getDB();
  const chats = (await db.get("chats", problemSlug)) || [];

  return chats.map((chat) => ({
    ...chat,
    lastUpdated: chat.lastUpdated ?? Date.now(),
  }));
};

export const saveSavedResponse = async (
  problemSlug: string,
  messageId: string,
): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction("saved-responses", "readwrite");
  const store = tx.objectStore("saved-responses");
  const saved = (await store.get(problemSlug)) || [];
  if (!saved.includes(messageId)) {
    saved.push(messageId);
    store.put(saved, problemSlug);
  }
  await tx.done;
};

export const loadSavedResponses = async (
  problemSlug: string,
): Promise<string[]> => {
  const db = await getDB();
  return (await db.get("saved-responses", problemSlug)) || [];
};
