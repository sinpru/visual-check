import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectEntry, ProjectStatus } from './types.ts';
import { readBuilds, deleteBuild } from './builds.ts';
import { logger } from './logger.ts';

const log = logger.child('projects');

// ─── Path resolution ──────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

function getProjectsPath(): string {
	const dir = process.env.SNAPSHOTS_DIR;
	if (!dir) throw new Error('SNAPSHOTS_DIR is not set in environment');
	const resolved = path.isAbsolute(dir) ? dir : path.resolve(REPO_ROOT, dir);
	return path.join(resolved, 'projects.json');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function writeProjects(projects: ProjectEntry[]): void {
	const filePath = getProjectsPath();
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(projects, null, 2));
	fs.renameSync(tmp, filePath);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Reads projects.json. Returns [] if file does not exist yet.
 */
export function readProjects(): ProjectEntry[] {
	const filePath = getProjectsPath();
	if (!fs.existsSync(filePath)) return [];
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProjectEntry[];
	} catch {
		return [];
	}
}

/**
 * Creates a new project entry and writes it to projects.json.
 */
export function createProject(name: string): ProjectEntry {
	const projects = readProjects();

	const project: ProjectEntry = {
		projectId: `project_${Date.now()}`,
		name: name.trim(),
		status: 'active',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	log.info(`Creating project "${project.name}" (${project.projectId})`);
	projects.push(project);
	writeProjects(projects);
	return project;
}

/**
 * Updates fields on an existing project.
 * No-ops silently if projectId is not found.
 */
export function updateProject(
	projectId: string,
	data: Partial<Pick<ProjectEntry, 'name' | 'status'>>,
): void {
	const projects = readProjects();
	const idx = projects.findIndex((p) => p.projectId === projectId);
	if (idx === -1) {
		log.warn(`Project not found for update: ${projectId}`);
		return;
	}

	log.debug(`Updating project ${projectId}`, data);
	projects[idx] = {
		...projects[idx],
		...data,
		updatedAt: new Date().toISOString(),
	};

	writeProjects(projects);
}

/**
 * Permanently removes a project from projects.json.
 * Also deletes all associated builds.
 */
export function deleteProject(projectId: string): void {
	const projects = readProjects();
	const project = projects.find((p) => p.projectId === projectId);
	if (!project) return;

	log.info(`Deleting project "${project.name}" (${projectId})`);
	writeProjects(projects.filter((p) => p.projectId !== projectId));

	// Delete associated builds
	const builds = readBuilds().filter((b) => b.projectId === projectId);
	log.debug(`Deleting ${builds.length} builds for project ${projectId}`);
	for (const build of builds) {
		deleteBuild(build.buildId);
	}
}
