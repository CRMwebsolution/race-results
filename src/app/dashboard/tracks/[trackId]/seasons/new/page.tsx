import {redirect} from "next/navigation";
export default async function New({params}:{params:Promise<{trackId:string}>}){const {trackId}=await params;redirect(`/dashboard/tracks/${trackId}/seasons`);}
