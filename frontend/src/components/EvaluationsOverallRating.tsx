interface EvaluationsOverallRatingProps {
  score: number | null | undefined;
  className?: string;
}

const EvaluationsOverallRating = ({ score, className = '' }: EvaluationsOverallRatingProps) => {
  if (score === null || score === undefined) {
    return (
      <div className={`flex items-center justify-left h-full ${className}`}>
        <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
      </div>
    );
  }

  // Arredondar para 2 casas decimais
  const roundedScore = Math.round(score * 100) / 100;

  // Definir cor baseada na nota (0-5)
  let colorClass = '';
  if (roundedScore >= 4) {
    colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  } else if (roundedScore >= 3) {
    colorClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  } else if (roundedScore >= 2) {
    colorClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  } else {
    colorClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  }

  return (
    <div className={`flex items-center justify-left h-full ${className}`}>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {roundedScore.toFixed(2)}
      </span>
    </div>
  );
};

export default EvaluationsOverallRating;
