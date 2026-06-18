import { purgeExpiredBlobs, type PurgeBindings } from "@/functions/storage/purge-expired-blobs";

export async function handleScheduled(
	_event: ScheduledEvent,
	env: PurgeBindings,
	_ctx: ExecutionContext,
) {
	await purgeExpiredBlobs(env);
}
