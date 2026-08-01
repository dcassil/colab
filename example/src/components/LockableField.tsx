/**
 * One text field wrapped with the reference `EditLock` interaction.
 *
 * FOCUS acquires the advisory lock (sends a `lock` event for this field's
 * scope); BLUR releases it (`clear`). While a REMOTE participant holds the lock,
 * this tab shows a lock indicator and the field is made read-only — advisory,
 * not enforced by the server. Leave-on-disconnect is handled by colab/server
 * roster reconciliation, so a peer closing its tab frees the lock automatically.
 *
 * NOTE (API-ergonomics gap filed to I4/I5): the reference `EditLock` selectors
 * are keyed by the branded `ScopeId`, but colab-ui exports neither `ScopeId`
 * nor `asScopeId` through its public entry, so a consumer cannot call
 * `selectors.lockedBy(scope)` at the boundary. We therefore read ownership from
 * the raw interaction `state` (a `Record<scope, ownerId>`) via `Object.entries`,
 * which needs no branded value. `send` accepts `unknown`, so emitting the event
 * with a plain string `scopeId` is fine (the reducer brands it on receipt).
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { EditLock } from "colab-ui";
import { useInteraction } from "colab-ui/react";
import type { Identity } from "colab-ui/react";

/** The scope id naming this one field. Plain string on the wire. */
const FIELD_SCOPE = "demo-field";

/** Owner id currently holding `FIELD_SCOPE`, or null — read from raw state. */
function ownerOf(
  state: Record<string, string> | undefined,
): string | null {
  if (state === undefined) return null;
  for (const [scope, owner] of Object.entries(state)) {
    if (scope === FIELD_SCOPE) return owner;
  }
  return null;
}

export function LockableField({
  identity,
}: {
  identity: Identity;
}): ReactElement {
  const { state, send } = useInteraction(EditLock);
  const [text, setText] = useState("");

  const owner = ownerOf(state);
  const lockedByRemote = owner !== null && owner !== identity.id;

  return (
    <label style={{ display: "block", margin: "8px 0 20px" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Shared note
        {lockedByRemote ? (
          <span
            data-testid="lock-indicator"
            style={{ fontSize: 12, color: "#b91c1c" }}
          >
            🔒 being edited by someone else
          </span>
        ) : null}
      </span>
      <input
        data-testid="lockable-field"
        value={text}
        readOnly={lockedByRemote}
        aria-disabled={lockedByRemote}
        placeholder="Focus to acquire the edit lock…"
        onFocus={() => {
          send({ scopeId: FIELD_SCOPE, action: "lock" });
        }}
        onBlur={() => {
          send({ scopeId: FIELD_SCOPE, action: "clear" });
        }}
        onChange={(event) => {
          setText(event.target.value);
        }}
        style={{
          width: "100%",
          marginTop: 4,
          padding: "8px 10px",
          borderRadius: 8,
          border: lockedByRemote ? "1px solid #b91c1c" : "1px solid #d4d4d8",
          background: lockedByRemote ? "#fef2f2" : "#fff",
        }}
      />
    </label>
  );
}
