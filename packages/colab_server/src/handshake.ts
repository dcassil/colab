import type { Identity } from "colab-protocol";
import type { JsonValue } from "colab-protocol";

export interface JoinRequest {
  roomId: string;
  identity: Identity;
  token?: string;
}

type UnknownRecord = Record<string, unknown>;

export function readJoinRequest(auth: unknown): JoinRequest | undefined {
  if (!isRecord(auth)) {
    return undefined;
  }

  const roomId = readString(auth.roomId);
  const identity = readIdentity(auth.identity);
  const token = readString(auth.token);

  if (roomId === undefined || identity === undefined) {
    return undefined;
  }

  return token === undefined ? { roomId, identity } : { roomId, identity, token };
}

function readIdentity(value: unknown): Identity | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value.id);
  const name = readString(value.name);
  const color = readString(value.color);

  if (id === undefined || name === undefined || color === undefined) {
    return undefined;
  }

  return isJsonObject(value.extra)
    ? { id, name, color, extra: value.extra }
    : { id, name, color };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isJsonObject(value);
}
