export { logger } from './src/logger.ts';

// AI reasoning
export {
	callAI,
	generateRegionDescription,
	generateRegionLabel,
	generateBatchRegionLabels,
} from './src/ai-reasoning.ts';

// Types
export type {
	ResultStatus,
	BuildStatus,
	ProjectStatus,
	FrameDimensions,
	DiffResult,
	DiffRegion,
	ResultEntry,
	BuildEntry,
	ProjectEntry,
	FigmaNodeDocument,
	FigmaNodeBoundingBox,
	FigmaFileResponse,
	FigmaNodesResponse,
	FigmaImagesResponse,
	FigmaNodeData,
} from './src/types.ts';

export { FigmaNodeNotFoundError, FigmaAssetFetchError } from './src/types.ts';

// Figma
export {
	getFrameDimensions,
	fetchFigmaBaseline,
	fetchFigmaBaselineWithTree,
	fetchNodeTree,
	findFigmaNodeForRegion,
	fetchFigmaFile,
	fetchNodesBatch,
	fetchImagesBatch,
	figmaGet,
	FIGMA_TTL,
} from './src/figma.ts';

// Diffing
export { runDiff } from './src/diff.ts';

// Storage
export {
	saveSnapshot,
	approveBaseline,
	getPaths,
	baselineRelPath,
	getSnapshotsDir,
	saveFigmaNodeTree,
	loadFigmaNodeTree,
	getBaselineDimensions,
} from './src/storage.ts';

// Results manifest
export {
	readResults,
	writeResult,
	updateStatus,
	updateRegionAnalysis,
} from './src/results.ts';

// Builds
export {
	readBuilds,
	createBuild,
	updateBuild,
	getOrCreateBuild,
	recalculateBuildStatus,
	deleteBuild,
} from './src/builds.ts';

// Projects
export {
	readProjects,
	createProject,
	updateProject,
	deleteProject,
} from './src/projects.ts';
