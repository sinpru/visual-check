export function relativeTime(date: string): string {
	const diff = Date.now() - new Date(date).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

export function formatDiffPercent(n: number): string {
	return `${n.toFixed(2)}%`;
}
