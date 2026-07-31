import type { Identity } from "colab-protocol";

export type AuthToken = string | undefined;

export type VerifyIdentity = (
  token: AuthToken,
  identity: Identity,
) => boolean | Promise<boolean>;

export const allowAll: VerifyIdentity = () => true;
