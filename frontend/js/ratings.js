// Échelle de forme de la journée : clés, libellés et scores numériques.
// Aucune dépendance — chargé en premier.
const VALS = ['TM','M','Moy','B','TB'];
const VLABEL = {TM:'TM', M:'M', Moy:'Moy', B:'B', TB:'TB'};
const VNAME_FR = {TM:'Très Mauvaise', M:'Mauvaise', Moy:'Moyenne', B:'Bonne', TB:'Très Bonne'};
const VNAME_EN = {TM:'Very Bad', M:'Bad', Moy:'Average', B:'Good', TB:'Very Good'};
// Initialisé depuis la langue stockée, et non figé sur le français : applyLang le
// réaffecte, mais tout rendu qui la précéderait afficherait sinon des libellés FR.
let VNAME = (localStorage.getItem('lang') || 'fr') === 'en' ? VNAME_EN : VNAME_FR;

const RSCORE = {TB:5,B:4,Moy:3,M:2,TM:1};
const RSCORE_INV = [null,'TM','M','Moy','B','TB'];
