import { ShelfPage } from "./shelf-page";

// トップ: 一般古典の棚。聖書は /bible、リアリズムは /realism
export default function Home() {
  return <ShelfPage shelf="classics" />;
}
