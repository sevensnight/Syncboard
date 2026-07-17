import { useState } from "react";
import { User, botInitial, randomName } from "../../assets/types";
import BotsList from "./botsList";

export default function JoinScreen(props: {
    joinViaCode: () => void;
    joinBots: (x: Array<botInitial>) => void;
    fbUser: User | undefined;
    disabled: boolean;
    name: string;
    addr: string;
    SetAddress: React.Dispatch<React.SetStateAction<string>>;
    SetName: React.Dispatch<React.SetStateAction<string>>;
    isSyncboardSource?: boolean;
    isRoomManagedByHost?: boolean;
    connectionStatus?: "idle" | "connecting" | "hosting" | "retrying" | "failed";
}) {
    const [tabIndex, SetTab] = useState(0);
    const [botsList, SetBotList] = useState<Array<botInitial>>([
        {
            name: randomName(),
            diff: "随机",
        },
    ]);

    const showManagedRoomHint = props.isSyncboardSource === true && props.isRoomManagedByHost === true;
    const isJoining = props.connectionStatus === "connecting" || props.connectionStatus === "retrying";

    return (
        <>
            <nav className="join">
                <button
                    data-tooltip-hover={"联机"}
                    data-select={tabIndex === 0}
                    onClick={() => {
                        SetTab(0);
                    }}
                >
                    <img src="online.png" alt="" />
                </button>
                <button
                    data-tooltip-hover={"机器人"}
                    data-select={tabIndex === 1}
                    onClick={() => {
                        SetTab(1);
                    }}
                >
                    <img src="bot.png" alt="" />
                </button>
            </nav>
            <br></br>

            {tabIndex === 1 ? (
                <>
                    <div key={"bots-name"}>
                        <p>请输入你的名字：</p>
                        {props.fbUser === undefined ? (
                            <input
                                type="text"
                                id="name"
                                onChange={(e) => {
                                    props.SetName(e.currentTarget.value);
                                }}
                                value={props.name}
                                placeholder="输入名字"
                            />
                        ) : (
                            <input type="text" id="name" disabled={true} value={props.fbUser.name} placeholder="输入名字" />
                        )}
                    </div>
                    <p>机器人设置：</p>
                    <BotsList
                        OnChange={(arr: botInitial[]) => {
                            SetBotList(arr);
                        }}
                    />

                    <center>
                        <button
                            onClick={() => {
                                props.joinBots(botsList);
                            }}
                            disabled={props.disabled}
                        >
                            开始
                        </button>
                    </center>
                </>
            ) : (
                <>
                    <div key={"online-code"}>
                        <p>请输入房间代码：</p>
                        <input
                            type="text"
                            id="name"
                            onChange={(e) => props.SetAddress(e.currentTarget.value)}
                            value={props.addr}
                            placeholder="输入代码"
                            readOnly={showManagedRoomHint}
                        />
                        {showManagedRoomHint ? (
                            <p style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>房间代码已由主应用自动注入。</p>
                        ) : null}
                    </div>

                    <div key={"online-name"}>
                        <p>请输入你的名字：</p>
                        {props.fbUser === undefined ? (
                            <input
                                type="text"
                                id="name"
                                onChange={(e) => {
                                    props.SetName(e.currentTarget.value);
                                }}
                                value={props.name}
                                placeholder="输入名字"
                            />
                        ) : (
                            <input type="text" id="name" disabled={true} value={props.name} placeholder="输入名字" />
                        )}
                    </div>

                    {props.isSyncboardSource ? (
                        <p style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>用户名与房间可自动从主应用同步。</p>
                    ) : null}

                    <center>
                        <button
                            onClick={() => {
                                props.joinViaCode();
                            }}
                            disabled={props.disabled}
                        >
                            {isJoining ? "正在加入..." : "加入"}
                        </button>
                    </center>
                </>
            )}
        </>
    );
}
