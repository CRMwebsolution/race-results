import type {Json} from './database';
export type Season={id:string;track_id:string|null;series_id:string|null;name:string;starts_on:string;ends_on:string|null;rules_revision:number;created_at:string};
export type ChampionshipClass={id:string;season_id:string;name:string;series_class_id:string|null;template_id:string|null};
export type Registration={id:string;season_id:string;class_id:string;display_name:string;vehicle_name:string;joined_on:string;left_on:string|null;created_at:string;legacy_roster_id:string|null};
export type ChampionshipRule={id:string;season_id:string;rank_start:number;rank_end:number;points:number};
export type PointsChange={id:string;season_id:string;registration_id:string;event_id:string|null;mode:'adjustment'|'override';points:number;previous_points:number|null;reason:string;actor_id:string;created_at:string};
export type ChampionshipVersion={id:string;season_id:string;version:number;source_revision:number;source_version_ids:string[];payload:Json;is_current:boolean;actor_id:string;published_at:string};
export type AutoTable<R,Required extends keyof R=never>={Row:R;Insert:Partial<R>&Pick<R,Required>;Update:Partial<R>;Relationships:[]};
