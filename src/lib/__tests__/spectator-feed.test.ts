import {expect,it} from 'vitest';
import {spectatorFeed} from '../spectator-feed';
const tracks=[{id:'LDMB',name:'LDMB',slug:'ldmb',state:'NC'}],series=[{id:'SEDOT',name:'SEDOT'}];
const events=[{id:'track',name:'Track in-house points race',slug:'same-date',local_date:'2026-06-01',status:'scheduled',published_revision:null,track_id:'LDMB',series_id:null,venue_description:null},{id:'series',name:'SEDOT at LDMB',slug:'same-date',local_date:'2026-06-01',status:'live',published_revision:1,track_id:null,series_id:'SEDOT',venue_description:'LDMB, venue text only'}];
it('keeps separate listings and routes even with the same date and venue',()=>{const feed=spectatorFeed(events,tracks,series,{});expect(feed.map(e=>e.id)).toEqual(['series','track']);expect(feed.map(e=>e.href)).toEqual(['/s/SEDOT/races/same-date','/r/ldmb/same-date']);});
it('track in-house championships remain tracks and touring races remain series',()=>{expect(spectatorFeed(events,tracks,series,{type:'track'}).map(e=>e.id)).toEqual(['track']);expect(spectatorFeed(events,tracks,series,{type:'series'}).map(e=>e.id)).toEqual(['series']);});
