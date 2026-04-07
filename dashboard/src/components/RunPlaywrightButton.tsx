'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import RunPlaywrightModal from './RunPlaywrightModal';

interface RunPlaywrightButtonProps {
  projectId: string;
}

export default function RunPlaywrightButton({
  projectId,
}: RunPlaywrightButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
          'bg-primary text-white hover:opacity-90 transition-opacity shadow-sm',
        )}
      >
        <Play className="h-4 w-4" />
        Run tests
      </button>

      {isModalOpen && (
        <RunPlaywrightModal
          projectId={projectId}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
