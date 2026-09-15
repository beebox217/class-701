import { describe, expect, it } from "vitest";
import { firebaseCollections } from "./firebase";

describe("Firebase class data configuration", () => {
  it("keeps the expected Firestore collection names", () => {
    expect(firebaseCollections).toEqual({
      transactions: "class701_transactions",
      students: "class701_students",
      settings: "class701_settings",
    });
  });
});
