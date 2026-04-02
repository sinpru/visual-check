"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProjectEntry, BuildEntry } from '@visual-check/core';
import StatusBadge from './StatusBadge';
import { relativeTime } from '@/lib/format';
import { ChevronRight, GitBranch, Layers, ImagePlus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ProjectListProps {
  projects: ProjectEntry[];
  builds: BuildEntry[];
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, builds }) => {
  const router = useRouter();

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50 [&_th]:border-b-0">
            <TableHead className="w-[280px] font-black uppercase tracking-wider text-[10px] text-slate-500 py-3 px-4">
              Project
            </TableHead>
            <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500 py-3">
              Context
            </TableHead>
            <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500 py-3">
              Status
            </TableHead>
            <TableHead className="text-right font-black uppercase tracking-wider text-[10px] text-slate-500 py-3">
              Stats
            </TableHead>
            <TableHead className="w-[50px] py-3 px-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const projectBuilds = builds.filter((b) => b.projectId === project.projectId);
            const sortedBuilds = [...projectBuilds].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const latest = sortedBuilds[0];
            const buildCount = projectBuilds.length;
            const isFigma = latest?.branch === 'figma';

            return (
              <TableRow
                key={project.projectId}
                className="group cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => router.push(`/projects/${project.projectId}`)}
              >
                <TableCell className="py-2.5 px-4 max-w-[200px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black text-slate-900 group-hover:text-primary transition-colors tracking-tight text-sm truncate">
                      {project.name}
                    </span>
                    <div className="text-[11px] font-medium text-slate-400">
                      Updated {relativeTime(project.updatedAt)}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-2.5">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      <span>{buildCount} build{buildCount !== 1 ? 's' : ''}</span>
                    </div>

                    {latest && (
                      <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                        {isFigma ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#1ABCFE]/10 text-[#0FA8E8] text-[11px] font-bold ring-1 ring-[#1ABCFE]/20">
                            <ImagePlus className="h-3 w-3" />
                            Figma baseline
                          </span>
                        ) : (
                          <>
                            <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate max-w-[120px]">
                              {latest.branch || 'main'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="py-2.5">
                  {latest ? <StatusBadge status={latest.status} /> : <span className="text-xs text-slate-400">No builds</span>}
                </TableCell>

                <TableCell className="py-2.5 text-right w-[140px]">
                  {latest ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-black text-slate-900">
                            {latest.changedSnapshots}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Changed
                          </span>
                        </div>
                        <span className="text-slate-200 text-xs">/</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-black text-slate-400">
                            {latest.totalSnapshots}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Total
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      {latest.totalSnapshots > 0 && (
                        <div className="h-1.5 w-full bg-slate-100 flex rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-1000"
                            style={{
                              width: `${(latest.passedSnapshots / latest.totalSnapshots) * 100}%`,
                            }}
                          />
                          <div
                            className="h-full bg-destructive transition-all duration-1000"
                            style={{
                              width: `${(latest.changedSnapshots / latest.totalSnapshots) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </TableCell>

                <TableCell className="py-2.5 px-4 text-right">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 transition-all">
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
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
