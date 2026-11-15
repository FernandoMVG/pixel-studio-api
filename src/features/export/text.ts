import { z } from 'zod';
import { findAnimation, parse, TRANSPARENT, type Project } from '../projects/model.ts';

const TextInput = z.object({ animation: z.string().min(1, 'Indica el nombre de la animación') });

/** Texto plano: cabecera, paleta y las filas de cada cuadro tal cual. */
export function exportText(project: Project, input: { animation: string }): string {
  const { animation } = parse(TextInput, input);
  const { fps, frames, holds } = project.animations[findAnimation(project, animation)]!;
  const palette = [`${TRANSPARENT} transparente`, ...Object.entries(project.palette).map(([k, p]) => `${k} ${p.name} ${p.color}`)].join(' | ');
  const lines = [
    `# ${project.name} · animación '${animation}' · ${frames.length} cuadros · ${fps} fps · ${project.width}×${project.height}`,
    `# Paleta: ${palette}`,
  ];
  frames.forEach((rows, i) => lines.push('', `# Cuadro ${i}${holds[i]! > 1 ? ` · dura ${holds[i]} tics` : ''}`, ...rows));
  return lines.join('\n') + '\n';
}
