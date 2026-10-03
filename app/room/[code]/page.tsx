import Game from '../../game';
export default async function RoomPage({params}:{params:Promise<{code:string}>}){const {code}=await params;return <Game initialCode={code}/>;}
