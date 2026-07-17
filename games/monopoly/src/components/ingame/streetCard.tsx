import RailIcon from "../../../public/rails.png";
import ElectricityIcon from "../../../public/elects.png";
import WaterIcon from "../../../public/water.png";

export interface StreetDisplayInfo {
    title: string;
    rent: number;
    rentWithColorSet: number;
    multpliedrent: [number, number, number, number, number];
    housesCost: number;
    hotelsCost: number;
    cardCost: number;
    group: string;
}

export interface UtilitiesDisplayInfo {
    title: string;
    cardCost: number;
    type: "water" | "electricity";
}
export interface RailroadDisplayInfo {
    title: string;
    cardCost: number;
}
export function translateGroup(s: string) {
    try {
        switch (s.toLowerCase()) {
            case "red":
                return "#ED1B24";
            case "darkgreen":
                return "#1FB25A";
            case "darkblue":
                return "#0072BB";
            case "yellow":
                return "#FEF200";
            case "purple":
                return "#955436";
            case "lightgreen":
                return "#AAE0FA";
            case "orange":
                return "#F7941D";
            case "violet":
                return "#D93A96";
            default:
                return s.toLowerCase();
        }
    } catch {
        return s;
    }
}
export default function selector({
    street,
    utility,
    railroad,
}: {
    street?: StreetDisplayInfo;
    utility?: UtilitiesDisplayInfo;
    railroad?: RailroadDisplayInfo;
}) {
    if (street !== undefined) {
        return <StreetCard args={street} />;
    } else if (utility !== undefined) {
        return <UtilityCard args={utility} />;
    } else if (railroad !== undefined) {
        return <RailroadCard args={railroad} />;
    } else {
        return <></>;
    }
}

function StreetCard({ args }: { args: StreetDisplayInfo }) {
    const _color = translateGroup(args.group);
    return (
        <div className="street-card">
            <div style={{ backgroundColor: _color }}>
                <p>地块信息</p>
                <h3>{args.title}</h3>
            </div>
            <div>
                <ol>
                    <li>
                        <p>租金</p>
                        <p>{args.rent}M</p>
                    </li>
                    <li>
                        <p>拥有同色地块时租金</p>
                        <p>{args.rentWithColorSet}M</p>
                    </li>
                    <li>
                        <p>1 栋房屋租金</p>
                        <p>{args.multpliedrent[0]}M</p>
                    </li>
                    <li>
                        <p>2 栋房屋租金</p>
                        <p>{args.multpliedrent[1]}M</p>
                    </li>
                    <li>
                        <p>3 栋房屋租金</p>
                        <p>{args.multpliedrent[2]}M</p>
                    </li>
                    <li>
                        <p>4 栋房屋租金</p>
                        <p>{args.multpliedrent[3]}M</p>
                    </li>
                    <li>
                        <p>旅馆租金</p>
                        <p>{args.multpliedrent[4]}M</p>
                    </li>
                </ol>
                <hr />
                <ol>
                    <li>
                        <p>房屋价格</p>
                        <p>{args.housesCost}M / 栋</p>
                    </li>
                    <li>
                        <p>旅馆价格</p>
                        <label>
                            {args.hotelsCost}M / 个
                            <br />
                            <p style={{ fontSize: "var(--mono-font-small)" }}>(另加 4 栋房屋)</p>
                        </label>
                    </li>
                </ol>

                <br />
                <hr />
                <h4>{args.cardCost}M</h4>
            </div>
        </div>
    );
}

function RailroadCard({ args }: { args: RailroadDisplayInfo }) {
    return (
        <div className="street-card">
            <div data-clear>
                <img
                    data-type="rail"
                    src={RailIcon.replace("/public", "")}
                    alt=""
                />
                <h3>{args.title}</h3>
            </div>
            <div>
                <ol>
                    <li>
                        <p>租金</p>
                        <p>{25}M</p>
                    </li>
                    <li>
                        <p>若拥有 2 个车站</p>
                        <p>{50}M</p>
                    </li>
                    <li>
                        <p>若拥有 3 个车站</p>
                        <p>{100}M</p>
                    </li>
                    <li>
                        <p>若拥有 4 个车站</p>
                        <p>{200}M</p>
                    </li>
                </ol>
                <h4>抵押价值 100M</h4>
                <hr />
                <br />
                <h4>{args.cardCost}M</h4>
            </div>
        </div>
    );
}

function UtilityCard({ args }: { args: UtilitiesDisplayInfo }) {
    return (
        <div className="street-card">
            <div data-clear>
                <center>
                    <img
                        data-type={args.type}
                        src={
                            args.type === "electricity"
                                ? ElectricityIcon.replace("/public", "")
                                : WaterIcon.replace("/public", "")
                        }
                        alt=""
                    />
                </center>
                <h3>{args.title}</h3>
            </div>
            <div>
                <p style={{ lineHeight: 1.1, paddingInline: "var(--mono-card-padding-x)" }}>
                    若拥有 1 个公用事业，租金为骰子点数的 4 倍。
                    <br />
                    <br />
                    若同时拥有 2 个公用事业，租金为骰子点数的 10 倍。
                </p>
                <hr />
                <br />
                <h4>{args.cardCost}M</h4>
            </div>
        </div>
    );
}
