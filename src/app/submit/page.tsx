import { redirect } from "next/navigation";

/** 收录申请已改为首页弹窗，旧路由跳回比价。 */
export default function SubmitPage() {
  redirect("/");
}
