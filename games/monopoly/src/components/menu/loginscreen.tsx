import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, setDoc, doc, getDoc } from "firebase/firestore";
import { FirebaseApp } from "firebase/app";
import { useState } from "react";
import { User } from "../../assets/types";
export default function LoginScreen(props: {
    admin: FirebaseApp | undefined;
    onLogin: (v: User, remember: boolean) => void;
    currentUser: User | undefined;
    onLogout: () => void;
}) {
    const [doRegister, SetRegisterMode] = useState<boolean>(false);

    return (
        <>
            {props.currentUser === undefined ? (
                <>
                    <nav className="login">
                        <button
                            data-selected={doRegister === false}
                            onClick={() => {
                                SetRegisterMode(false);
                            }}
                        >
                            登录
                        </button>
                        <button
                            data-selected={doRegister === true}
                            onClick={() => {
                                SetRegisterMode(true);
                            }}
                        >
                            注册
                        </button>
                    </nav>
                    <br />
                    <main className="login">
                        {doRegister ? (
                            <input
                                id="login-name"
                                type="text"
                                placeholder="昵称"
                            />
                        ) : (
                            <></>
                        )}
                        <input
                            type="text"
                            id="login-email"
                            placeholder="邮箱"
                        />
                        <input
                            type="password"
                            id="login-password"
                            placeholder="密码"
                        />
                        <p>
                            记住此账号
                            <input
                                type="checkbox"
                                style={{ display: "inline-block" }}
                                placeholder="密码"
                                id="rememberacc"
                            />
                        </p>
                    </main>

                    <center>
                        {" "}
                        <button
                            onClick={() => {
                                if (props.admin === undefined) {
                                    alert("Firebase 连接失败");
                                    return;
                                }
                                const auth = getAuth(props.admin);
                                const email = (
                                    document.getElementById(
                                        "login-email"
                                    ) as HTMLInputElement
                                ).value;
                                const password = (
                                    document.getElementById(
                                        "login-password"
                                    ) as HTMLInputElement
                                ).value;
                                if (doRegister) {
                                    const name = (
                                        document.getElementById(
                                            "login-name"
                                        ) as HTMLInputElement
                                    ).value;

                                    createUserWithEmailAndPassword(
                                        auth,
                                        email,
                                        password
                                    )
                                        .then((userCredential) => {
                                            updateProfile(userCredential.user, {
                                                displayName: name,
                                            });
                                            const userId =
                                                userCredential.user.uid;
                                            // @ts-ignore
                                            document.userid = userId;
                                            if (props.admin === undefined) {
                                                alert(
                                                    "Firebase 连接失败"
                                                );
                                                return;
                                            }
                                            const firestore = getFirestore(
                                                props.admin
                                            );
                                            const userDoc = {
                                                email,
                                                name,
                                                score: 0,
                                                id: userId,
                                            } as User;
                                            setDoc(
                                                doc(
                                                    firestore,
                                                    `Users/${userId}`
                                                ),
                                                userDoc
                                            );
                                            userDoc.id = userId;
                                            props.onLogin(
                                                userDoc,
                                                (
                                                    document.getElementById(
                                                        "rememberacc"
                                                    ) as HTMLInputElement
                                                ).checked ?? false
                                            );
                                        })
                                        .catch((r) => {
                                            alert(r);
                                        });
                                } else {
                                    signInWithEmailAndPassword(
                                        auth,
                                        email,
                                        password
                                    )
                                        .then((userCredential) => {
                                            const userId =
                                                userCredential.user.uid;
                                            // @ts-ignore
                                            document.userid = userId;

                                            if (props.admin !== undefined) {
                                                // Read Firebase User
                                                getDoc(
                                                    doc(
                                                        getFirestore(
                                                            props.admin
                                                        ),
                                                        `Users/${userId}`
                                                    )
                                                )
                                                    .then((v) => {
                                                        const userDoc =
                                                            v.data() as User;
                                                        userDoc.id = userId;
                                                        props.onLogin(
                                                            userDoc,
                                                            (
                                                                document.getElementById(
                                                                    "rememberacc"
                                                                ) as HTMLInputElement
                                                            ).checked ?? false
                                                        );
                                                    })
                                                    .catch((r) => {
                                                        alert(r);
                                                    });
                                            } else {
                                                alert(
                                                    "无法连接到 Firebase"
                                                );
                                            }
                                        })
                                        .catch((r) => {
                                            alert(r);
                                        });
                                }
                            }}
                        >
                            {doRegister ? "注册" : "登录"}
                        </button>
                    </center>
                </>
            ) : (
                <>
                    <div className="user-credentials">
                        <p>
                            {props.currentUser.name}{" "}
                            <p style={{ opacity: 0.5 }}>
                                [
                                <p style={{ fontStyle: "italic" }}>
                                    {props.currentUser.email}
                                </p>
                                ]
                            </p>
                        </p>
                        <button
                            onClick={() => {
                                // @ts-ignore
                                document.userid = undefined;
                                props.onLogout();
                            }}
                        >
                            退出登录
                        </button>
                    </div>
                    <h2>用户统计</h2>
                    <table>
                        <tr>
                            <td>积分</td>
                            <td>{props.currentUser.score}</td>
                        </tr>
                    </table>
                </>
            )}
        </>
    );
}
