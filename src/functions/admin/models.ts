import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { z } from "zod";
import { createDb } from "@/db/client";
import {
	deleteModel as deleteModelQuery,
	getByIdForUser as getModelByIdForUser,
	listByProviderForUser,
	updateHealthStatus,
	upsert as upsertModelQuery,
} from "@/db/queries/ai-models";
import { getByIdForUser as getProviderByIdForUser } from "@/db/queries/ai-providers";
import {
	CONFIG_KEY_DEFAULT_AI_MODEL,
	deleteConfigValue,
	getConfigValue,
	setConfigValue,
} from "@/db/queries/config";
import { createId } from "@/db/queries/helpers";
import {
	deleteModelSchema,
	listModelsSchema,
	setDefaultModelSchema,
	testModelSchema,
	upsertModelSchema,
} from "@/functions/admin/models-schemas";
import { probeModel } from "@/functions/admin/probe-model";
import { requireDB } from "@/functions/db";
import { requireAdminSession } from "@/lib/rbac";

async function requireOwnedProvider(
	db: ReturnType<typeof createDb>,
	providerId: string,
	userId: string,
) {
	const provider = await getProviderByIdForUser(db, providerId, userId);
	if (!provider) throw new Response("Not Found", { status: 404 });
	return provider;
}

export async function listModelsHandler(
	input: z.infer<typeof listModelsSchema>,
	headers: Headers,
) {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());
	await requireOwnedProvider(db, input.providerId, session.user.id);
	return {
		models: await listByProviderForUser(db, input.providerId, session.user.id),
	};
}

export async function upsertModelHandler(
	input: z.infer<typeof upsertModelSchema>,
	headers: Headers,
) {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());
	const { providerId, ...fields } = input;
	await requireOwnedProvider(db, providerId, session.user.id);
	const id = await upsertModelQuery(db, {
		id: createId(),
		providerId,
		...fields,
	});
	return { id };
}

export async function deleteModelHandler(
	input: z.infer<typeof deleteModelSchema>,
	headers: Headers,
) {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());
	const model = await getModelByIdForUser(db, input.id, session.user.id);
	if (!model) throw new Response("Not Found", { status: 404 });
	if (
		(await getConfigValue(db, session.user.id, CONFIG_KEY_DEFAULT_AI_MODEL)) ===
		input.id
	) {
		await deleteConfigValue(db, session.user.id, CONFIG_KEY_DEFAULT_AI_MODEL);
	}
	await deleteModelQuery(db, input.id, session.user.id);
}

export async function testModelHandler(
	input: z.infer<typeof testModelSchema>,
	headers: Headers,
) {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());
	const model = await getModelByIdForUser(db, input.id, session.user.id);
	if (!model) throw new Response("Not Found", { status: 404 });
	const result = await probeModel(db, session.user.id, input);
	await updateHealthStatus(
		db,
		input.id,
		session.user.id,
		result.ok ? "health" : "offline",
	);
	return result;
}

export async function setDefaultModelHandler(
	input: z.infer<typeof setDefaultModelSchema>,
	headers: Headers,
) {
	const session = await requireAdminSession(headers);
	const db = createDb(await requireDB());
	const userId = session.user.id;
	if (input.modelId === null) {
		await deleteConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL);
		return;
	}
	const model = await getModelByIdForUser(db, input.modelId, userId);
	if (!model) throw new Response("Not Found", { status: 404 });
	if (!model.enabled) throw new Response("Model is disabled", { status: 400 });
	const provider = await getProviderByIdForUser(db, model.providerId, userId);
	if (!provider?.enabled) {
		throw new Response("Provider is disabled", { status: 400 });
	}
	await setConfigValue(db, userId, CONFIG_KEY_DEFAULT_AI_MODEL, input.modelId);
}

export const listModels = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => listModelsSchema.parse(data))
	.handler(async ({ data }) => listModelsHandler(data, getRequest().headers));

export const upsertModel = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => upsertModelSchema.parse(data))
	.handler(async ({ data }) => upsertModelHandler(data, getRequest().headers));

export const deleteModel = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteModelSchema.parse(data))
	.handler(async ({ data }) => deleteModelHandler(data, getRequest().headers));

export const setDefaultModel = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => setDefaultModelSchema.parse(data))
	.handler(async ({ data }) =>
		setDefaultModelHandler(data, getRequest().headers),
	);

export const testModel = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => testModelSchema.parse(data))
	.handler(async ({ data }) => testModelHandler(data, getRequest().headers));

export {
	deleteModelSchema,
	listModelsSchema,
	setDefaultModelSchema,
	testModelSchema,
	upsertModelSchema,
} from "@/functions/admin/models-schemas";
