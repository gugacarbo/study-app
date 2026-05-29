import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SearchResult {
	path: string;
	content: string;
}

export function SearchMemoryCard({
	searchQuery,
	onSearchQueryChange,
	onSearch,
	searchResults,
	isSearching,
}: {
	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	onSearch: () => void;
	searchResults: SearchResult[];
	isSearching: boolean;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Search Memory</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex gap-2">
					<Input
						type="text"
						placeholder="Search saved sessions, notes, and docs..."
						value={searchQuery}
						onChange={(e) => onSearchQueryChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && searchQuery.trim()) {
								onSearch();
							}
						}}
					/>
					<Button
						onClick={onSearch}
						disabled={isSearching || !searchQuery.trim()}
					>
						{isSearching ? "Searching..." : "Search"}
					</Button>
				</div>

				{searchResults.length > 0 && (
					<div className="flex flex-col gap-2">
						{searchResults.map((result) => (
							<Card key={`${result.path}:${result.content}`} size="sm">
								<CardContent className="p-2">
									<p className="mb-1 text-xs text-muted-foreground">
										{result.path}
									</p>
									<p className="text-sm">{result.content.slice(0, 220)}</p>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
