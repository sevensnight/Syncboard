import Slider from "./utils/slider";
import {
    MonopolySettings,
    MonopolyCookie,
    EngineSettings,
} from "../assets/types";
import { useState, useEffect } from "react";
import { CookieManager } from "../assets/cookieManager";
export default function settingsNav() {
    const cookie = JSON.parse(decodeURIComponent(CookieManager.get("monopolySettings") as string)) as MonopolyCookie;
    const l: {
        gameEngine: [
            EngineSettings,
            React.Dispatch<React.SetStateAction<EngineSettings>>
        ];
        numbers: [number, React.Dispatch<React.SetStateAction<number>>][];
        booleans: [boolean, React.Dispatch<React.SetStateAction<boolean>>][];
    } = {
        gameEngine: useState<EngineSettings>("2d"),
        numbers: [
            useState<number>(
                cookie.settings ? cookie.settings.accessibility[0] : 45
            ),
            useState<number>(
                cookie.settings ? cookie.settings.accessibility[1] : 5
            ),
            useState<number>(cookie.settings ? cookie.settings.audio[0] : 100),
            useState<number>(cookie.settings ? cookie.settings.audio[1] : 100),
            useState<number>(cookie.settings ? cookie.settings.audio[2] : 25),
        ],
        booleans: [
            useState<boolean>(
                cookie.settings ? cookie.settings.accessibility[2] : false
            ),
            useState<boolean>(
                cookie.settings ? cookie.settings.accessibility[3] : false
            ),
            useState<boolean>(
                cookie.settings ? cookie.settings.accessibility[4] : false
            ),
            useState<boolean>(
                cookie.settings ? cookie.settings.notifications : false
            ),
        ],
    };

    useEffect(() => {
        const cookie = JSON.parse(decodeURIComponent(CookieManager.get("monopolySettings") as string)) as MonopolyCookie;
        const settings = {
            gameEngine: l.gameEngine[0],
            accessibility: [
                l.numbers[0][0],
                l.numbers[1][0],
                l.booleans[0][0],
                l.booleans[1][0],
                l.booleans[2][0],
            ],
            audio: [l.numbers[2][0], l.numbers[3][0], l.numbers[4][0]],
            notifications: l.booleans[3][0],
        } as MonopolySettings;

        CookieManager.set("monopolySettings",encodeURIComponent( JSON.stringify({
            login: cookie.login,
            settings: settings,
        } as MonopolyCookie)))
    }, [
        l.gameEngine[0],
        ...l.numbers.map((v) => v[0]),
        ,
        ...l.booleans.map((v) => v[0]),
    ]);
    return (
        <>
            <h3 style={{ textAlign: "center" }}>设置</h3>
            <div className="scroll">
                <div className="settingsItem">
                    <p>游戏引擎 </p>
                    <div>
                        <select name="" id="">
                            <option>2D</option>
                            <option>3D</option>
                        </select>
                    </div>
                </div>
                <p
                    style={{
                        marginBlock: 0,
                        marginInline: 10,
                        fontSize: 12,
                        opacity: 0.5,
                    }}
                >
                    3D 还未开发{" "}
                </p>
                <br />
                <hr />
                <h2>无障碍</h2>
                <div>
                    <div className="settingsItem">
                        <p>旋转速度 </p>

                        <Slider
                            step={90 / 8}
                            min={0}
                            max={180}
                            defaultValue={l.numbers[0][0]}
                            onChange={(e) => {
                                l.numbers[0][1](
                                    parseFloat(e.currentTarget.value)
                                );
                            }}
                            fixedNum={2}
                            suffix="°"
                        />
                    </div>
                    <div className="settingsItem">
                        <p>缩放速度 </p>
                        <Slider
                            step={1}
                            min={1}
                            max={10}
                            defaultValue={l.numbers[1][0]}
                            onChange={(e) => {
                                l.numbers[1][1](
                                    parseFloat(e.currentTarget.value)
                                );
                            }}
                            fixedNum={0}
                        />
                    </div>
                    <div className="settingsItem">
                        <p>显示用户 ID </p>
                        <div>
                            <input
                                defaultChecked={l.booleans[0][0]}
                                type="checkbox"
                                onChange={(e) => {
                                    l.booleans[0][1](e.currentTarget.checked);
                                }}
                            />
                        </div>
                    </div>
                    <div className="settingsItem">
                        <p>显示用户鼠标 </p>
                        <div>
                            <input
                                defaultChecked={l.booleans[1][0]}
                                type="checkbox"
                                onChange={(e) => {
                                    l.booleans[1][1](e.currentTarget.checked);
                                }}
                            />
                        </div>
                    </div>
                    <div className="settingsItem">
                        <p>为用户添加颜色 </p>
                        <div>
                            <input
                                defaultChecked={l.booleans[2][0]}
                                type="checkbox"
                                onChange={(e) => {
                                    l.booleans[2][1](e.currentTarget.checked);
                                }}
                            />
                        </div>
                    </div>
                    <br />
                    <hr />
                </div>
                <h2>音频</h2>
                <div>
                    <div className="settingsItem">
                        <p>主音量 </p>
                        <Slider
                            step={1}
                            min={0}
                            max={100}
                            defaultValue={l.numbers[2][0]}
                            fixedNum={0}
                            suffix="%"
                            onChange={(e) => {
                                l.numbers[2][1](
                                    parseFloat(e.currentTarget.value)
                                );
                            }}
                        />
                    </div>
                    <div className="settingsItem">
                        <p>音效音量 </p>
                        <Slider
                            step={1}
                            min={0}
                            max={100}
                            defaultValue={l.numbers[3][0]}
                            fixedNum={0}
                            suffix="%"
                            onChange={(e) => {
                                l.numbers[3][1](
                                    parseFloat(e.currentTarget.value)
                                );
                            }}
                        />
                    </div>
                    <div className="settingsItem">
                        <p>音乐音量 </p>
                        <Slider
                            step={1}
                            min={0}
                            max={100}
                            defaultValue={l.numbers[4][0]}
                            fixedNum={0}
                            suffix="%"
                            onChange={(e) => {
                                l.numbers[4][1](
                                    parseFloat(e.currentTarget.value)
                                );
                            }}
                        />
                    </div>
                    <br />
                    <hr />
                </div>
                <h2>通知</h2>
                <div>
                    <div className="settingsItem">
                        <p>通知余额变化 </p>
                        <div>
                            <input
                                defaultChecked={l.booleans[3][0]}
                                type="checkbox"
                                onChange={(e) => {
                                    l.booleans[3][1](e.currentTarget.checked);
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
