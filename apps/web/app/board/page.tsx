import { AppFrame } from "@/components/AppFrame";
import { TopBar } from "@/components/TopBar";

export default function BoardPage() {
  return (
    <AppFrame top={<TopBar right={<span className="topbar-count" aria-label="0 cards">0</span>} />}>
      <div className="empty-board">
        <p className="status">No cards yet.</p>
      </div>
    </AppFrame>
  );
}
