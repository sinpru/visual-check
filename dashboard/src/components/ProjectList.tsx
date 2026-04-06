'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectEntry, BuildEntry } from '@visual-check/core';
import StatusBadge from './StatusBadge';
import { relativeTime } from '@/lib/format';
import {
  ChevronRight,
  GitBranch,
  Layers,
  ImagePlus,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface ProjectListProps {
  projects: ProjectEntry[];
  builds: BuildEntry[];
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, builds }) => {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (
      !confirm(
        'Are you sure you want to delete this project? All associated builds and data will be permanently removed.',
      )
    ) {
      return;
    }

    setDeletingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete project');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50 [&_th]:border-b-0">
            <TableHead className="w-70 font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3 px-4">
              Project
            </TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3">
              Context
            </TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3">
              Status
            </TableHead>
            <TableHead className="text-right font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3">
              Stats
            </TableHead>
            <TableHead className="w-25 py-3 px-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const projectBuilds = builds.filter(
              (b) => b.projectId === project.projectId,
            );
            const sortedBuilds = [...projectBuilds].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
            const latest = sortedBuilds[0];
            const buildCount = projectBuilds.length;
            const isFigma = latest?.branch === 'figma';

            return (
              <TableRow
                key={project.projectId}
                className="group cursor-pointer hover:bg-gray-50/60 transition-colors"
                onClick={() => router.push(`/projects/${project.projectId}`)}
              >
                <TableCell className="py-3 px-4 max-w-50">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-gray-900 group-hover:text-primary transition-colors tracking-tight text-sm truncate">
                      {project.name}
                    </span>
                    <div className="text-[11px] font-normal text-gray-400">
                      Updated {relativeTime(project.updatedAt)}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-3">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-600">
                      <Layers className="h-3.5 w-3.5 text-gray-400" />
                      <span>
                        {buildCount} build{buildCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {latest && (
                      <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-600">
                        {isFigma ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#1ABCFE]/10 text-[#0FA8E8] text-[11px] font-medium ring-1 ring-[#1ABCFE]/20">
                            <ImagePlus className="h-3 w-3" />
                            Figma baseline
                          </span>
                        ) : (
                          <>
                            <GitBranch className="h-3.5 w-3.5 text-gray-400" />
                            <span className="truncate max-w-30">
                              {latest.branch || 'main'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="py-3">
                  {latest ? (
                    <StatusBadge status={latest.status} />
                  ) : (
                    <span className="text-xs text-gray-400">No builds</span>
                  )}
                </TableCell>

                <TableCell className="py-3 text-right w-35">
                  {latest ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold text-gray-900">
                            {latest.changedSnapshots}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
                            Changed
                          </span>
                        </div>
                        <span className="text-gray-200 text-xs">/</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-bold text-gray-400">
                            {latest.totalSnapshots}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
                            Total
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      {latest.totalSnapshots > 0 && (
                        <div className="h-1 w-full bg-gray-100 flex rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-700"
                            style={{
                              width: `${(latest.passedSnapshots / latest.totalSnapshots) * 100}%`,
                            }}
                          />
                          <div
                            className="h-full bg-red-500 transition-all duration-700"
                            style={{
                              width: `${(latest.changedSnapshots / latest.totalSnapshots) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </TableCell>

                <TableCell className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      onClick={(e) => handleDelete(e, project.projectId)}
                      disabled={deletingId === project.projectId}
                    >
                      {deletingId === project.projectId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-gray-200 transition-all">
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default ProjectList;
