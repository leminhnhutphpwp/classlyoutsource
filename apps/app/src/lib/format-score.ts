/**
 * Format score display: removes trailing zeros for whole numbers, keeps 1 decimal for decimals
 * @param score - The score value (number or string)
 * @param maxScore - The maximum score (number or string, optional, defaults to 100)
 * @returns Formatted score string like "79/100" or "79.5/100"
 * 
 * @example
 * formatScore(79, 100) // "79/100"
 * formatScore(79.5, 100) // "79.5/100"
 * formatScore(79.0, 100) // "79/100"
 * formatScore(79.00, 100) // "79/100"
 */
export function formatScore(score: number | string | null | undefined, maxScore?: number | string | null | undefined): string {
  if (score === null || score === undefined) {
    return '-';
  }

  const numScore = typeof score === 'string' ? parseFloat(score) : score;
  
  if (isNaN(numScore)) {
    return '-';
  }

  // Format score: remove trailing zeros for whole numbers, keep 1 decimal for decimals
  const formattedScore = numScore % 1 === 0 ? numScore.toString() : numScore.toFixed(1);
  
  // Format max score
  const numMaxScore = maxScore !== null && maxScore !== undefined 
    ? (typeof maxScore === 'string' ? parseFloat(maxScore) : maxScore)
    : 100;
  
  const formattedMaxScore = isNaN(numMaxScore) ? '100' : (numMaxScore % 1 === 0 ? numMaxScore.toString() : numMaxScore.toFixed(1));
  
  return `${formattedScore}/${formattedMaxScore}`;
}

/**
 * Format score with percentage
 * @param score - The score value (number or string)
 * @param maxScore - The maximum score (number or string, optional, defaults to 100)
 * @returns Object with formatted score string and percentage
 * 
 * @example
 * formatScoreWithPercentage(79, 100) // { score: "79/100", percentage: 79 }
 */
export function formatScoreWithPercentage(score: number | string | null | undefined, maxScore?: number | string | null | undefined): { score: string; percentage: number } {
  const scoreStr = formatScore(score, maxScore);
  
  const numScore = score !== null && score !== undefined 
    ? (typeof score === 'string' ? parseFloat(score) : score)
    : 0;
  const numMaxScore = maxScore !== null && maxScore !== undefined 
    ? (typeof maxScore === 'string' ? parseFloat(maxScore) : maxScore)
    : 100;
  
  const percentage = numMaxScore > 0 ? Math.round((numScore / numMaxScore) * 100) : 0;
  
  return { score: scoreStr, percentage };
}

/**
 * Format average grade/score: removes trailing zeros for whole numbers, keeps 1 decimal for decimals
 * @param value - The average grade value (number or string)
 * @returns Formatted grade string like "79" or "79.6"
 * 
 * @example
 * formatAverageGrade(79) // "79"
 * formatAverageGrade(79.6) // "79.6"
 * formatAverageGrade(79.0) // "79"
 * formatAverageGrade(79.60) // "79.6"
 */
export function formatAverageGrade(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '0';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0';
  }

  // Format: remove trailing zeros for whole numbers, keep 1 decimal for decimals
  return numValue % 1 === 0 ? numValue.toString() : numValue.toFixed(1);
}

