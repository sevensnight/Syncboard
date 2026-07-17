import { useEffect, useState } from "react";
import "../../users.css";
export default function Gallery() {
    useEffect(() => {
        document.title = "大富翁用户";
    }, []);
    const [tabIndex, SetTab] = useState<number>(0);
    return (
        <main className="users">
            <nav>
                <button
                    data-select={tabIndex === 0}
                    onClick={() => {
                        SetTab(0);
                    }}
                >
                    好友
                </button>
                <button
                    data-select={tabIndex === 1}
                    onClick={() => {
                        SetTab(1);
                    }}
                >
                    排行榜
                </button>
            </nav>
            <main></main>
        </main>
    );
}
