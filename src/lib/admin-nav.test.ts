import { describe, expect, it } from "vitest";
import { ADMIN_NAV_ITEMS, getAdminPageTitle } from "@/lib/admin-nav";

describe("ADMIN_NAV_ITEMS match", () => {
	const [configItem, modelsItem, usersItem, jobsItem] = ADMIN_NAV_ITEMS;

	it("marks config routes as active by prefix", () => {
		expect(configItem.match("/admin/config")).toBe(true);
		expect(configItem.match("/admin/config/")).toBe(true);
		expect(configItem.match("/admin/models")).toBe(false);
		expect(configItem.match("/admin/users")).toBe(false);
		expect(configItem.match("/admin/jobs")).toBe(false);
	});

	it("marks models routes as active by prefix", () => {
		expect(modelsItem.match("/admin/models")).toBe(true);
		expect(modelsItem.match("/admin/models/")).toBe(true);
		expect(modelsItem.match("/admin/config")).toBe(false);
		expect(modelsItem.match("/admin/users")).toBe(false);
	});

	it("marks users routes as active by prefix", () => {
		expect(usersItem.match("/admin/users")).toBe(true);
		expect(usersItem.match("/admin/users/")).toBe(true);
		expect(usersItem.match("/admin/config")).toBe(false);
		expect(usersItem.match("/admin/jobs")).toBe(false);
	});

	it("marks jobs routes as active by prefix", () => {
		expect(jobsItem.match("/admin/jobs")).toBe(true);
		expect(jobsItem.match("/admin/jobs/")).toBe(true);
		expect(jobsItem.match("/admin/config")).toBe(false);
		expect(jobsItem.match("/admin/users")).toBe(false);
	});
});

describe("getAdminPageTitle", () => {
	it("returns Config for config routes", () => {
		expect(getAdminPageTitle("/admin/config")).toBe("Config");
		expect(getAdminPageTitle("/admin/config/")).toBe("Config");
	});

	it("returns Usuários for users routes", () => {
		expect(getAdminPageTitle("/admin/users")).toBe("Usuários");
		expect(getAdminPageTitle("/admin/users/")).toBe("Usuários");
	});

	it("returns Jobs for jobs routes", () => {
		expect(getAdminPageTitle("/admin/jobs")).toBe("Jobs");
		expect(getAdminPageTitle("/admin/jobs/")).toBe("Jobs");
	});

	it("falls back for unknown admin paths", () => {
		expect(getAdminPageTitle("/admin")).toBe("Administração");
		expect(getAdminPageTitle("/admin/other")).toBe("Administração");
	});
});
