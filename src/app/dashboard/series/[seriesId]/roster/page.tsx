import {redirect} from "next/navigation";
export default async function Legacy({params}:{params:Promise<{seriesId:string}>}){const {seriesId}=await params;redirect(`/dashboard/series/${seriesId}/seasons`);}
