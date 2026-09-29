export type DigestDeliveryClaim = {
  status: "sending" | "sent" | "failed";
  updated_at: string;
};

const RETRY_AFTER_MS = 15 * 60 * 1000;

export function canRetryDigestDelivery(claim: DigestDeliveryClaim, now = new Date()) {
  if (claim.status === "sent") return false;
  if (claim.status === "failed") return true;

  const updatedAt = new Date(claim.updated_at).getTime();
  return Number.isFinite(updatedAt) && now.getTime() - updatedAt >= RETRY_AFTER_MS;
}
