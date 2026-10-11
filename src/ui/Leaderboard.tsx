import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { canonicalConfig, type GameConfig } from "../game/config";
import { getHistory, getRanking, errorMessage } from "../data/api";
export function Leaderboard({
  tab,
  playerId,
  config,
}: {
  tab: "ranking" | "history";
  playerId: string;
  config: Readonly<GameConfig>;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey:
      tab === "ranking"
        ? ["ranking", canonicalConfig(config), page]
        : ["history", playerId, page],
    queryFn: ({ signal }) =>
      tab === "ranking"
        ? getRanking(config, page, signal)
        : getHistory(playerId, page, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
  const data = query.data;
  return (
    <section
      className="leaderboard"
      aria-label={tab === "ranking" ? "Ranking" : "Match History"}
    >
      <div className="list-heading">
        <h2>{tab === "ranking" ? "Legends of the sea" : "Your voyages"}</h2>
        <span>
          {query.isFetching && !query.isPending
            ? "Refreshing…"
            : data
              ? `${data.total} voyages`
              : ""}
        </span>
      </div>
      {tab === "ranking" && (
        <p className="filter-note">
          Same rules · {config.sessionSeconds}s session · {config.spawnSeconds}s
          spawn · score per match
        </p>
      )}
      {query.isPending && (
        <p role="status" className="list-message">
          Consulting the captain’s log…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="error-message">
          {errorMessage(query.error)}{" "}
          <button className="text-button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      )}
      {data && data.items.length === 0 && (
        <p className="list-message">
          {tab === "ranking"
            ? "These waters have no legends yet. Be the first."
            : "Your story starts with your first completed voyage."}
        </p>
      )}
      {data && data.items.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {tab === "ranking" ? (
                  <>
                    <th>Rank</th>
                    <th>Captain</th>
                    <th>Score</th>
                  </>
                ) : (
                  <>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Voyage</th>
                    <th>Result</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.items.map((record, index) => (
                <tr
                  key={record.id}
                  className={record.playerId === playerId ? "your-row" : ""}
                >
                  {tab === "ranking" ? (
                    <>
                      <td className="rank">{(page - 1) * 10 + index + 1}</td>
                      <td>
                        {record.playerName}
                        {record.playerId === playerId && <small> YOU</small>}
                      </td>
                      <td className="score-cell">{record.score}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        {new Date(record.completedAt).toLocaleDateString(
                          "en-US",
                        )}
                      </td>
                      <td className="score-cell">{record.score}</td>
                      <td>{Math.floor(record.duration)}s</td>
                      <td>
                        {record.reason === "time_expired"
                          ? "Survived"
                          : "Ship lost"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <nav className="pagination" aria-label="Pagination">
          <button
            className="text-button"
            disabled={page === 1 || query.isPlaceholderData}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Previous
          </button>
          <span>
            Page {page} of {Math.max(1, Math.ceil(data.total / 10))}
          </span>
          <button
            className="text-button"
            disabled={page * 10 >= data.total || query.isPlaceholderData}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  );
}
