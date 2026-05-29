import { useState } from "react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getMemoryOverview, searchMemory } from "../../server-functions/memory";

import { LearningProfileCard } from "./learning-profile-card";
import { RecentSessionsCard } from "./recent-sessions-card";
import { SessionVisualization } from "./session-visualization";
import { SearchMemoryCard } from "./search-memory-card";
import { TopicNotesCard } from "./topic-notes-card";
import { MemoryDocumentsCard } from "./memory-documents-card";

export function MemoryPanel() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
		null,
	);

	const { data } = useSuspenseQuery({
		queryKey: ["memory-overview"],
		queryFn: () => getMemoryOverview(),
	});

	const searchMutation = useMutation({
		mutationFn: (query: string) => searchMemory({ data: { query } }),
	});

	const profileSummary = data.profileNotes
		? data.profileNotes.slice(0, 600)
		: "";
	const selectedSession =
		data.recentSessions.find((s) => s.id === selectedSessionId) ?? null;

	return (
		<div className="flex flex-col gap-4">
			<LearningProfileCard profileSummary={profileSummary} />
			<RecentSessionsCard
				sessions={data.recentSessions}
				selectedSession={selectedSession}
				onSelectSession={(id) => setSelectedSessionId(id)}
			/>
			{selectedSession && <SessionVisualization session={selectedSession} />}
			<SearchMemoryCard
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				onSearch={() => {
					if (searchQuery.trim()) {
						searchMutation.mutate(searchQuery.trim());
					}
				}}
				searchResults={searchMutation.data?.results ?? []}
				isSearching={searchMutation.isPending}
			/>
			<TopicNotesCard topicNotes={data.topicNotes} />
			<MemoryDocumentsCard documents={data.documents} />
		</div>
	);
}
