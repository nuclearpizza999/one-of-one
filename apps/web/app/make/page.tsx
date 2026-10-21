import { Card } from "@one-of-one/card";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";

export default function MakePage() {
  return (
    <AppFrame
      top={
        <TopBar
          right={
            <span className="icon-target" aria-label="Cancel">
              <Icon name="close" size={20} />
            </span>
          }
        />
      }
    >
      <div className="card-area">
        <Card photo={null} place="" date="" coords="" number={null} />
      </div>
    </AppFrame>
  );
}
