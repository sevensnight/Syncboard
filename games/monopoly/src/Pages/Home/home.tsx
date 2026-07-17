import { useState, useRef, useEffect } from "react";
import Monopoly from "./monopoly.tsx";
import "../../home.css";
import { Server, Socket, io } from "../../assets/sockets.ts";
import NotifyElement, { NotificatorRef } from "../../components/notificator.tsx";
import { MonopolyCookie, User, botInitial } from "../../assets/types.ts";
import SettingsNav from "../../components/settingsNav.tsx";

// import LoginScreen from "../../components/menu/loginscreen.tsx";
import JoinScreen from "../../components/menu/joinScreen.tsx";
// env
// import { FirebaseApp, initializeApp } from "firebase/app";
// import { doc, getDoc, getFirestore } from "firebase/firestore";

import { main as onlineServer } from "../../assets/server.ts";
import { main as botServer } from "../../assets/bot/server.ts";
import { main as runBot } from "../../assets/bot/bot.ts";
import Slider from "../../components/utils/slider.tsx";
import { TranslateCode } from "../../assets/code.ts";
import { CookieManager } from "../../assets/cookieManager.ts";

export default function Home() {
    var cookie: MonopolyCookie;
    try {
        const getCookieString = CookieManager.get("monopolySettings");
        if (getCookieString === null) throw new Error("no cookie");
        const obj = JSON.parse(decodeURIComponent(getCookieString));
        cookie = obj;
    } catch {
        cookie = {
            login: {
                remember: false,
                id: "",
            },
        } as MonopolyCookie;

        CookieManager.set("monopolySettings", encodeURIComponent(JSON.stringify(cookie as MonopolyCookie)));
    }

    const notifyRef = useRef<NotificatorRef>(null);
    const [socket, SetSocket] = useState<Socket>();
    // Gameplay stuff
    const [name, SetName] = useState<string>("");
    const [addr, SetAddress] = useState<string>("");

    // Account stuff
    // const [firebase, setFirebase] = useState<FirebaseApp>();
    const [
        remember,
        // @ts-ignore
        SetRemember,
    ] = useState<boolean>(cookie.login.remember);
    const [
        fbUser,
        // @ts-ignore
        SetFbUser,
    ] = useState<User>();

    const [disabled, SetDisabled] = useState<boolean>(false);
    const [isSignedIn, SetSignedIn] = useState<boolean>(false);
    const [tabIndex, SetTab] = useState<number>(0);

    // Server Stuff
    const [server, SetServer] = useState<Server | undefined>(undefined);
    const [serverPCount, SetServerPCount] = useState<number>(6);

    type ConnectionStatus = "idle" | "connecting" | "hosting" | "retrying" | "failed";
    const [connectionStatus, SetConnectionStatus] = useState<ConnectionStatus>("idle");
    const [connectionMessage, SetConnectionMessage] = useState<string>("");
    const [isSyncboardSource, SetIsSyncboardSource] = useState<boolean>(false);
    const [isRoomManagedByHost, SetIsRoomManagedByHost] = useState<boolean>(false);

    const autoJoinTriggeredRef = useRef<boolean>(false);
    const nameRef = useRef<string>("");

    useEffect(() => {
        document.title = "大富翁";
        // const _firebase = initializeApp(ENV.firebase);
        // setFirebase(_firebase);
        var cookie: MonopolyCookie;
        try {
            const obj = JSON.parse(decodeURIComponent(CookieManager.get("monopolySettings") as string));
            cookie = obj;
            if (cookie.login.remember && cookie.login.id.length > 0) {
                // const db = getFirestore(_firebase);
                // getDoc(doc(db, `Users/${cookie.login.id}`)).then((v) => {
                //     const userData = v.data() as User;
                //     SetFbUser(userData);
                //     SetName(userData.name);
                // });
            }
        } catch {}
    }, []);

    useEffect(() => {
        nameRef.current = name;
    }, [name]);

    const saveLoginCookie = () => {
        try {
            const cookie = JSON.parse(decodeURIComponent(CookieManager.get("monopolySettings") as string)) as MonopolyCookie;
            if (fbUser === undefined) throw Error("undefined");

            cookie.login = {
                id: fbUser.id,
                remember,
            };

            CookieManager.set("monopolySettings", encodeURIComponent(JSON.stringify(cookie as MonopolyCookie)));
        } catch {
            const cookie = {
                login: {
                    id: "",
                    remember: false,
                },
            } as MonopolyCookie;
            CookieManager.set("monopolySettings", encodeURIComponent(JSON.stringify(cookie as MonopolyCookie)));
        }
    };

    const waitForConnectionState = async (currentSocket: Socket, onConnected?: (connectedSocket: Socket) => void) => {
        return new Promise<boolean>((resolve) => {
            let settled = false;
            const timeoutHandle = setTimeout(() => {
                if (settled) return;
                SetConnectionStatus("failed");
                SetConnectionMessage("等待房间响应超时");
                notifyRef.current?.message("连接超时，请重试", "error", 2, () => {
                    SetDisabled(false);
                });
                currentSocket.disconnect();
                finish(false);
            }, 7000);

            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutHandle);
                resolve(ok);
            };

            currentSocket.on("state", (args: number) => {
                switch (args) {
                    case 0:
                        SetSocket(currentSocket);
                        SetSignedIn(true);
                        SetDisabled(false);
                        SetConnectionStatus("idle");
                        SetConnectionMessage("");
                        onConnected?.(currentSocket);
                        finish(true);
                        break;
                    case 1:
                        SetConnectionStatus("failed");
                        SetConnectionMessage("房间内游戏已开始");
                        notifyRef.current?.message("游戏已开始", "error", 2, () => {
                            SetDisabled(false);
                        });
                        currentSocket.disconnect();
                        finish(false);
                        break;
                    case 2:
                        SetConnectionStatus("failed");
                        SetConnectionMessage("房间玩家已满");
                        notifyRef.current?.message("服务器玩家已满", "error", 2, () => {
                            SetDisabled(false);
                        });
                        currentSocket.disconnect();
                        finish(false);
                        break;
                    default:
                        SetConnectionStatus("failed");
                        SetConnectionMessage("加入房间时收到未知状态");
                        notifyRef.current?.message("未知错误", "error", 2, () => {
                            SetDisabled(false);
                        });
                        currentSocket.disconnect();
                        finish(false);
                        break;
                }
            });
        });
    };

    const connectToRoom = async (
        roomCode: string,
        statusText: string,
        options?: {
            onConnected?: (connectedSocket: Socket) => void;
            silentFailure?: boolean;
        }
    ) => {
        const normalizedRoom = roomCode.trim();
        if (normalizedRoom.length === 0) {
            SetConnectionStatus("failed");
            SetConnectionMessage("房间代码为空");
            notifyRef.current?.message("请输入房间代码", "info", 2);
            return false;
        }

        SetDisabled(true);
        SetConnectionStatus("connecting");
        SetConnectionMessage(statusText);

        try {
            const currentSocket = await io(TranslateCode(normalizedRoom));
            return await waitForConnectionState(currentSocket, options?.onConnected);
        } catch {
            SetConnectionStatus("failed");
            SetConnectionMessage(`无法连接到房间 ${normalizedRoom}`);
            if (!options?.silentFailure) {
                notifyRef.current?.message(`无法连接到房间 ${normalizedRoom}`, "error", 2, () => {
                    SetDisabled(false);
                });
            } else {
                SetDisabled(false);
            }
            return false;
        }
    };

    const startHostForRoom = async (roomCode?: string) => {
        return new Promise<Server>((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error("服务器启动超时"));
            }, 7000);

            onlineServer(
                serverPCount,
                (host, startedServer) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    startedServer.code = host;
                    SetAddress(host);
                    SetServer(startedServer);
                    resolve(startedServer);
                },
                roomCode,
                (error) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            );
        });
    };

    const autoJoinFromHostContext = async (roomCode: string) => {
        if (autoJoinTriggeredRef.current) {
            return;
        }

        autoJoinTriggeredRef.current = true;
        SetTab(0);

        if (nameRef.current.trim().length === 0) {
            SetConnectionStatus("failed");
            SetConnectionMessage("缺少用户名，无法自动加入房间");
            notifyRef.current?.message("自动加入失败：缺少用户名", "error", 2);
            return;
        }

        saveLoginCookie();

        const firstTry = await connectToRoom(roomCode, `正在连接房间 ${roomCode}...`, {
            silentFailure: true,
        });
        if (firstTry) {
            return;
        }

        SetConnectionStatus("hosting");
        SetConnectionMessage(`正在启动房间 ${roomCode}...`);
        try {
            await startHostForRoom(roomCode);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isRaceCase = /unavailable|taken|already|exist|id/i.test(message);
            if (!isRaceCase) {
                SetConnectionStatus("failed");
                SetConnectionMessage(`启动房间失败：${message}`);
                notifyRef.current?.message(`启动房间失败：${message}`, "error", 2, () => {
                    SetDisabled(false);
                });
                return;
            }
        }

        SetConnectionStatus("retrying");
        SetConnectionMessage(`正在重试连接房间 ${roomCode}...`);
        await new Promise((resolve) => setTimeout(resolve, 700));
        await connectToRoom(roomCode, `正在连接房间 ${roomCode}...`);
    };

    const joinButtonClicked = async () => {
        if (name.replace(" ", "").length === 0) {
            notifyRef.current?.message("加入前请先输入你的名字", "info", 2);
            return;
        }

        if (addr.trim().length === 0) {
            notifyRef.current?.message("请输入房间代码", "info", 2);
            return;
        }

        saveLoginCookie();
        await connectToRoom(addr, `正在连接房间 ${addr}...`);
    };

    useEffect(() => {
        const uriParams = new URLSearchParams(document.location.search);
        const usernameParam = (uriParams.get("username") ?? "").trim();
        const roomParam = (uriParams.get("room") ?? uriParams.get("ip") ?? "").trim();
        const source = uriParams.get("source") ?? "";
        const shouldAutoJoin = uriParams.get("autojoin") === "1";
        const fromSyncboard = source === "syncboard";

        SetIsSyncboardSource(fromSyncboard);
        SetIsRoomManagedByHost(fromSyncboard && uriParams.has("room") && roomParam.length > 0);

        if (usernameParam.length > 0) {
            SetName(usernameParam);
            nameRef.current = usernameParam;
        }

        if (roomParam.length > 0) {
            SetAddress(roomParam);
        }

        if (shouldAutoJoin && roomParam.length > 0) {
            void autoJoinFromHostContext(roomParam);
        }
    }, []);

    function startButtonClicked(bots: botInitial[]) {
        try {
            if (name.replace(" ", "").length === 0) {
                notifyRef.current?.message("加入前请先输入你的名字", "info", 2);
                return;
            }

            SetConnectionStatus("hosting");
            SetConnectionMessage("正在启动机器人房间...");
            botServer(async (server) => {
                SetDisabled(true);
                const socket = await io(TranslateCode(server.code));
                for (const x of bots) {
                    runBot(TranslateCode(server.code), x);
                }
                socket.on("state", (args: number) => {
                    switch (args) {
                        case 0:
                            SetSocket(socket);
                            SetSignedIn(true);
                            SetServer(server);
                            SetDisabled(false);
                            SetConnectionStatus("idle");
                            SetConnectionMessage("");

                            break;
                        case 1:
                            SetConnectionStatus("failed");
                            SetConnectionMessage("房间内游戏已开始");
                            notifyRef.current?.message("游戏已开始", "error", 2, () => {
                                SetDisabled(false);
                            });
                            socket.disconnect();
                            break;
                        case 2:
                            SetConnectionStatus("failed");
                            SetConnectionMessage("房间玩家已满");
                            notifyRef.current?.message("服务器玩家已满", "error", 2, () => {
                                SetDisabled(false);
                            });
                            socket.disconnect();
                            break;
                        default:
                            SetConnectionStatus("failed");
                            SetConnectionMessage("加入房间时收到未知状态");
                            notifyRef.current?.message("未知错误", "error", 2, () => {
                                SetDisabled(false);
                            });
                            socket.disconnect();

                            break;
                    }
                });
            });
        } catch {
            SetDisabled(false);
            SetConnectionStatus("failed");
            SetConnectionMessage("机器人模式启动失败");
        }
    }

    const handleLeaveToSetup = () => {
        socket?.disconnect();
        SetSocket(undefined);
        SetSignedIn(false);
        SetDisabled(false);
        SetConnectionStatus("idle");
        SetConnectionMessage("");
        SetTab(0);
    };

    return socket !== undefined && isSignedIn === true ? (
        <Monopoly socket={socket} name={name} server={server} onLeaveToSetup={handleLeaveToSetup} />
    ) : (
        <>
            <NotifyElement ref={notifyRef} />
            <div className="entry">
                <nav>
                    <button
                        data-select={tabIndex === 0}
                        onClick={() => {
                            SetTab(0);
                        }}
                        data-tooltip-hover="游玩"
                    >
                        <img src="./icon.png" alt="" />
                    </button>
                    <button
                        data-select={tabIndex === 1}
                        onClick={() => {
                            SetTab(1);
                        }}
                        data-tooltip-hover="服务器"
                    >
                        <img src="./server.png" alt="" />
                    </button>
                    <button
                        data-select={tabIndex === 2}
                        onClick={() => {
                            SetTab(2);
                        }}
                        disabled={true}
                        data-tooltip-hover="账号"
                    >
                        <img src="./human.png" alt="" />
                    </button>
                    <br />
                    <button
                        data-select={tabIndex === 3}
                        onClick={() => {
                            SetTab(3);
                        }}
                        data-tooltip-hover="关于"
                    >
                        <img src="./credits.png" alt="" />
                    </button>
                    <button
                        data-select={tabIndex === 4}
                        onClick={() => {
                            SetTab(4);
                        }}
                        data-tooltip-hover="设置"
                    >
                        <img src="./settings.png" alt="" />
                    </button>
                </nav>
                <main>
                    {tabIndex === 4 ? (
                        <SettingsNav />
                    ) : tabIndex === 3 ? (
                        <>
                            <p>本项目由 Itay Layzerovich 制作。</p>
                            <div style={{ color: "white" }}>
                                <p>作为该大富翁项目的开发者，现就以下法律事项作出说明：</p>
                                <ol>
                                    <li>
                                        <i>游戏机制与规则：</i> 大富翁的核心机制与规则已被广泛认知和使用多年。本项目旨在以数字化形式还原经典大富翁体验，使用的是公众熟知的通用玩法概念。
                                    </li>
                                    <li>
                                        <i>原版大富翁知识产权：</i>
                                        Monopoly 桌游的商标与版权归 Hasbro Inc. 及其相关授权方所有。本项目并非 Hasbro Inc. 的官方产品，也不代表存在任何直接关联或背书。
                                    </li>
                                    <li>
                                        <i>许可与使用：</i> 本项目定位为教育与个人用途，作为免费开源项目供学习交流，不以商业使用或商业分发为目的。
                                    </li>
                                    <li>
                                        <i>合理使用与演绎作品：</i>
                                        本项目可被视为基于原作进行数字化演绎的作品，旨在提供不同形式的体验；无意与原商标权利人的商业利益竞争或造成损害。
                                    </li>
                                    <li>
                                        <i>无担保与责任限制：</i> 尽管已尽力提供稳定且有趣的体验，本项目仍按“现状”提供，不附带任何明示或暗示担保。开发者不对使用本软件产生的问题或损失承担责任。
                                    </li>
                                    <li>
                                        <i>署名与第三方资源：</i> 本项目可能包含已按要求标注来源并遵循各自许可协议的第三方库或素材。相关署名与许可信息应按原作者要求保留。
                                    </li>
                                    <li>
                                        <i>个人责任：</i> 作为开发者或使用者，你应遵守所有适用法律（包括知识产权相关法律），并确保在合法边界内使用本项目。
                                    </li>
                                </ol>
                            </div>
                        </>
                    ) : // tabIndex === 2 ? (
                    //     <>
                    //         <header>
                    //             <p style={{ fontSize: 13, marginBottom: 0 }}>Account</p>
                    //             <div className="loginPageHeader">
                    //                 <h3>Login</h3>
                    //                 <div className="scoreboardIcon">
                    //                     <img
                    //                         onClick={() => {
                    //                             document.location.href = "/Monopoly/users";
                    //                         }}
                    //                         src="scoreboard.png"
                    //                     />
                    //                 </div>
                    //             </div>
                    //         </header>
                    //         <LoginScreen
                    //             admin={undefined}
                    //             currentUser={fbUser}
                    //             onLogout={() => {
                    //                 SetRemember(false);
                    //                 SetFbUser(undefined);
                    //                 SetName("");
                    //             }}
                    //             onLogin={(v, b) => {
                    //                 SetTab(0);
                    //                 SetRemember(b);
                    //                 SetFbUser(v);
                    //                 SetName(v.name);
                    //                 if (!b) return;
                    //                 try {
                    //                     var cookie = JSON.parse(document.cookie) as MonopolyCookie;
                    //                     cookie.login = {
                    //                         remember: true,
                    //                         id: v.id,
                    //                     };
                    //                     document.cookie = JSON.stringify(cookie as MonopolyCookie);
                    //                 } catch {
                    //                     var cookie = {
                    //                         login: {
                    //                             remember: true,
                    //                             id: v.id,
                    //                         },
                    //                     } as MonopolyCookie;
                    //                     document.cookie = JSON.stringify(cookie as MonopolyCookie);
                    //                 }
                    //             }}
                    //         />
                    //     </>
                    // ) :
                    tabIndex === 1 ? (
                        <>
                            <header>
                                <p
                                    style={{
                                        fontSize: 12,
                                        marginBottom: 0,
                                    }}
                                >
                                    PeerJS 托管
                                </p>
                                <h3>启动服务器</h3>
                            </header>
                            {server !== undefined ? (
                                <>
                                    <p>服务器已在运行，请在控制台查看日志。</p>
                                    <table>
                                        <tr>
                                            <td>邀请码</td>
                                            <td style={{ userSelect: "all" }}>{server.code}</td>
                                        </tr>
                                    </table>
                                    <center>
                                        {" "}
                                        <button
                                            key={"kllserver-button"}
                                            style={{
                                                backgroundColor: "red",
                                                marginTop: 12,
                                            }}
                                            onClick={() => {
                                                server.stop();
                                                SetServer(undefined);
                                            }}
                                        >
                                            关闭服务器
                                        </button>
                                    </center>
                                </>
                            ) : (
                                <>
                                    <p>所有服务器日志都可以在控制台中查看。</p>
                                    <table>
                                        <tr>
                                            <td>玩家数量</td>
                                            <td>
                                                <Slider
                                                    onChange={(e) => {
                                                        SetServerPCount(parseInt(e.currentTarget.value));
                                                    }}
                                                    max={6}
                                                    min={1}
                                                    defaultValue={serverPCount}
                                                    step={1}
                                                />
                                            </td>
                                        </tr>
                                    </table>
                                    <center>
                                        {" "}
                                        <button
                                            key={"startserver-button"}
                                            style={{
                                                marginTop: 13,
                                            }}
                                            disabled={disabled}
                                            onClick={async () => {
                                                SetDisabled(true);
                                                SetConnectionStatus("hosting");
                                                SetConnectionMessage("正在启动服务器...");
                                                try {
                                                    await startHostForRoom();
                                                    SetConnectionStatus("idle");
                                                    SetConnectionMessage("");
                                                    SetDisabled(false);
                                                } catch (error) {
                                                    const message = error instanceof Error ? error.message : String(error);
                                                    SetConnectionStatus("failed");
                                                    SetConnectionMessage(`启动服务器失败：${message}`);
                                                    notifyRef.current?.message(`启动服务器失败：${message}`, "error", 2, () => {
                                                        SetDisabled(false);
                                                    });
                                                }
                                            }}
                                        >
                                            {disabled && connectionStatus === "hosting" ? "正在启动服务器" : "启动服务器"}
                                        </button>
                                    </center>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <header>
                                欢迎来到 <h3>大富翁</h3>
                                <p
                                    style={{ fontSize: 9, cursor: "pointer", opacity: 0.8, width: "fit-content" }}
                                    onClick={() => {
                                        document.location.href = "/";
                                    }}
                                >
                                    @itaylayzer - 10.12.23
                                </p>
                                游戏
                            </header>
                            {connectionStatus !== "idle" ? (
                                <p style={{ fontSize: 12, opacity: 0.85 }}>
                                    {connectionMessage.length > 0
                                        ? connectionMessage
                                        : connectionStatus === "connecting"
                                        ? "正在连接房间..."
                                        : connectionStatus === "hosting"
                                        ? "正在启动房间..."
                                        : connectionStatus === "retrying"
                                        ? "正在重试连接..."
                                        : "连接失败"}
                                </p>
                            ) : null}
                            <JoinScreen
                                disabled={disabled}
                                fbUser={fbUser}
                                joinBots={(x) => {
                                    startButtonClicked(x);
                                }}
                                joinViaCode={() => {
                                    void joinButtonClicked();
                                }}
                                SetAddress={SetAddress}
                                SetName={SetName}
                                addr={addr}
                                name={name}
                                isSyncboardSource={isSyncboardSource}
                                isRoomManagedByHost={isRoomManagedByHost}
                                connectionStatus={connectionStatus}
                            />
                        </>
                    )}
                </main>
            </div>
        </>
    );
}
