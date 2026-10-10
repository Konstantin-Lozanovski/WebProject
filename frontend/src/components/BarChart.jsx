// "chart.js/auto" switches on every part of chart.js (bars, axes, tooltips),
// so nothing has to be registered by hand before a chart can be drawn
import "chart.js/auto";
import { Bar } from "react-chartjs-2";

// chart.js does not understand var(--accent), so the accent color of
// styles.css is repeated here. Change one, change the other.
const BAR_COLOR = "#4f6f8c";

const OPTIONS = {
  // Bars that go from left to right, so the labels are written beside them
  // and stay readable in a narrow column
  indexAxis: "y",
  plugins: {
    // One set of bars needs no legend; the title of the card says what it is
    legend: { display: false },
  },
  scales: {
    // The values are counts, so the axis shows whole numbers only
    x: { beginAtZero: true, ticks: { precision: 0 } },
  },
};

// The one chart of the app: a card with a bar for every label.
// labels and values are two lists of the same length, and emptyText is shown
// in place of the bars when every value is 0.
const BarChart = ({ title, labels, values, emptyText }) => {
  const isEmpty = values.every((value) => value === 0);

  const data = {
    labels,
    datasets: [{ label: title, data: values, backgroundColor: BAR_COLOR }],
  };

  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="card-body">
        {isEmpty ? (
          <p className="text-muted mb-0">{emptyText}</p>
        ) : (
          <Bar data={data} options={OPTIONS} />
        )}
      </div>
    </div>
  );
};

export default BarChart;
