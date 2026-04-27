import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'src', 'data', 'ai_insight.json');
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    return Response.json({
      insight: data.insight,
      label: data.label || 'Ascend AI',
      generatedAt: data.generatedAt
    });
  } catch (error) {
    console.error('Failed to read AI insight:', error);
    return Response.json({
      insight: "Ask Antigravity to refresh your AI insights to see your latest coaching analysis.",
      label: "Ascend AI"
    });
  }
}
