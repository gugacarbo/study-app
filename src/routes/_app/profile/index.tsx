import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/features/profile/pages/profile-page";

export const Route = createFileRoute("/_app/profile/")({
	component: ProfileRoute,
});

function ProfileRoute() {
	return <ProfilePage />;
}
