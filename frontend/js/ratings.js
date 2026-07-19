// Day-form scale: keys, labels and numeric scores.
// No dependency — loaded first.
const VALS = ['TM','M','Moy','B','TB'];
const VLABEL = {TM:'TM', M:'M', Moy:'Moy', B:'B', TB:'TB'};
const VNAME_FR = {TM:'Très Mauvaise', M:'Mauvaise', Moy:'Moyenne', B:'Bonne', TB:'Très Bonne'};
const VNAME_EN = {TM:'Very Bad', M:'Bad', Moy:'Average', B:'Good', TB:'Very Good'};
// Initialised from the stored language rather than pinned to French: applyLang
// reassigns it, but any render happening before that would otherwise show FR labels.
let VNAME = (localStorage.getItem('lang') || 'fr') === 'en' ? VNAME_EN : VNAME_FR;

const RSCORE = {TB:5,B:4,Moy:3,M:2,TM:1};
const RSCORE_INV = [null,'TM','M','Moy','B','TB'];
