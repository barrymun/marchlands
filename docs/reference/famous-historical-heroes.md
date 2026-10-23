# Famous historical heroes (Age 2)

**Version:** Evony Age 2. The original Age 1 server that Marchlands ports has none in its data; this note is reference for the spike in [TODO.md](../../TODO.md), *Famous historical heroes*.

**Sources:**

1. A spreadsheet of every famous historical hero in Age 2 with their four attributes, supplied by the maintainer (2026-10-23). Where it was compiled from isn't recorded.
2. *Famous Historical Heroes*, Evony Wiki: <https://evony.fandom.com/wiki/Famous_Historical_Heroes>. How they were found and captured, and a short history of some of them. The wiki's list is marked incomplete and gives no stats.

## How they worked

From source 2, in short:

- From Inn level 5, the Inn passed on rumours of famous heroes; more Inn levels, more rumours. The list could be refreshed for 100 gold.
- Paying (in the game's paid currency) for a hero's details gave where the hero was on the map and the portrait needed to capture them, as a report. If another player captured or moved the hero first, the details had to be bought again.
- Accepting the hunt added a hero quest, with a reward on completion.

## Their attributes

Age 2 heroes have four attributes; Age 1 and Marchlands have three:

| Age 2 | Marchlands | What it does in Marchlands |
|---|---|---|
| Politics | management | as mayor, production and building times |
| Attack | power | the army's attack |
| Intelligence | stratagem | as mayor, research times |
| Leadership | none | in Age 2, how many troops a hero leads |

Across the 636 heroes below: Politics 20–99 (mean 65), Intelligence 20–99 (60), Attack 28–99 (73), Leadership 30–139 (85); the four together 210–382 (283). Each hero is strong in one or two attributes and weak in another. For comparison, a Marchlands Inn hero's base attributes are rolled by `randomStat` (`shared/core/src/heroes.ts`): 15–35 two times in three, and above 75 almost never.

## Candidates for the Marchlands

A first pass over the list for people of the Marchlands' lands (the Empire's German, Czech, Lotharingian and Italian states), with their attributes in the table below:

- **Carolingians,** before the period but its founders: Charlemagne, Pepin the Short, Louis the Pious, Louis the German, Lothair I, Charles the Bald.
- **Emperors, dukes and their families:** Otto I, Lothair III, Henry the Proud, Henry the Lion, Frederick II, Duke of Swabia, Frederick Barbarossa (twice, as Frederick Barbarossa and Frederick I Barbarossa, with different stats), Henry VI, Empress Matilda.
- **Lotharingia:** Godfrey of Bouillon.
- **The Church:** St. Hildebrand (Pope Gregory VII, of Canossa), Hildegard von Bingen, St. Bruno of Cologne, Albertus Magnus, Gottschalk of Orbais.
- **Grand Masters of the Teutonic Order** (13th century): Hermann von Salza, Konrad von Thuringen, Heinrich von Hohenlohe, Konrad von Feuchtwangen, Heinrich von Tunna, Otto von Kerpen, Heinrich Walpot von Bassenheim.

Nobody from Bohemia, Moravia, Carinthia, Friesland or the Italian states of the period is on the list, so those would be our own additions (Matilda of Tuscany, Bretislav I, Ottokar II and the like).

## The list

As in the spreadsheet, in its order (alphabetical, nearly), with its spellings (AlbertusMagnus, Henry Hudsun and the like). Two rows that were exact copies (Burebista, Nicolaus Copernicus) appear once; Publius Cornelius Lentulus Sura is listed twice with different attributes, as in the spreadsheet. — marks an attribute the spreadsheet leaves blank (46 heroes).

| Hero | Politics | Intelligence | Attack | Leadership |
|---|---|---|---|---|
| Abbas I | 38 | 80 | 65 | 69 |
| Abel of Denmark | 32 | 88 | 85 | 120 |
| Abu al-Makarim | 50 | 43 | 83 | 81 |
| Abu Tammam | 64 | 86 | 88 | 122 |
| Achaeus | 28 | 84 | 70 | 100 |
| Adam Smith | 73 | 66 | 95 | 111 |
| Adelard of Bath | 67 | 32 | 81 | 72 |
| Aeschylus | 53 | 66 | 85 | 99 |
| Aethelstan | 98 | 47 | 83 | 95 |
| Afonso de Albuquerque | 40 | 82 | 60 | 95 |
| Agesilaus II | 89 | 38 | 73 | 81 |
| Akbar | 82 | 25 | 69 | 107 |
| Al Hassan Addakhil | 85 | 39 | 73 | 82 |
| AlbertusMagnus | 92 | 40 | 90 | 30 |
| Albrecht Durer | 55 | 45 | 80 | 72 |
| Albrecht von Wallenstein | 35 | 84 | 58 | 92 |
| Aldus Manutius | 60 | 71 | 90 | 30 |
| Aldus Manutius, the Elder | 60 | 35 | 83 | 66 |
| Aldus Manutius, the Younger | 72 | 40 | 88 | 33 |
| Alessandro Farnese, Duke of Parma | 34 | 78 | 60 | 95 |
| Alexander I of Scotland | 65 | 32 | 72 | 87 |
| Alexander Suvorov | 41 | 88 | 69 | 110 |
| Alexander the Great | 96 | 51 | 78 | 96 |
| Alexius I Comnenus | 89 | 42 | 69 | 87 |
| Alfgifu of Northampton | 84 | 35 | 60 | 66 |
| Alfonso de Borja | 81 | 30 | 60 | 95 |
| Alix of France | 84 | 38 | 58 | 66 |
| Al-Shahrazuri | 55 | 56 | 87 | 99 |
| Alvar Nunez Cabeza De Vaca | 32 | 83 | 55 | 91 |
| Amanieu De Sescars | 65 | 25 | 80 | 72 |
| Amerigo Vespucci | 81 | 70 | 73 | 30 |
| Amin Al-Din Rashid | 50 | 42 | 81 | 90 |
| Amy Robsart | 82 | 52 | 56 | 64 |
| Andrea Doria | 88 | 43 | 60 | 79 |
| Andrea Mantegna | 55 | 55 | 87 | 86 |
| Andrea Palladio | 52 | 34 | 83 | 79 |
| Andreas Vesalius | 43 | 50 | 81 | 83 |
| Angelique Brulon | 46 | 86 | 66 | 111 |
| Angelo Poliziano | 50 | 36 | 84 | 78 |
| Ann Bates | 50 | 40 | 80 | 74 |
| Anna Comnena | 61 | 32 | 78 | 78 |
| Anna Rheinholdsdotter Leuhusen | 50 | 70 | 86 | 102 |
| Anne Boleyn | 95 | 51 | 77 | 94 |
| Anne Hutchinson | 94 | 80 | 60 | 105 |
| Anne of Cleves | 88 | 42 | 69 | 111 |
| Anne of Denmark | 80 | 40 | 53 | 73 |
| Anne-Joseph Theroigne de Mericount | 81 | 50 | 46 | 80 |
| Anno von Sangerhausen | 45 | 87 | 62 | 111 |
| Anthony Van Dyck | 50 | 66 | 81 | 98 |
| Antipater | 51 | 96 | 89 | 130 |
| Antoine de Bourbon | 79 | 34 | 62 | 64 |
| Antonia Minor | — | 28 | 59 | — |
| Antonio Allegri Correggio | 33 | 64 | 82 | 97 |
| Antonio Pierozzi | 77 | 70 | 94 | 30 |
| Appianus | 63 | 59 | 93 | 30 |
| Appius Claudius Caudex | 98 | 46 | 84 | 100 |
| Arbella Stuart | 70 | 25 | 78 | 55 |
| Archibald Douglas | 84 | 30 | 65 | 54 |
| Aretes III, King of Nabata | 53 | 97 | 90 | 133 |
| Aristillus | 32 | 60 | 82 | 94 |
| Aristobulus II, King of Judea | 31 | 79 | 64 | 95 |
| Aristotle | 62 | 54 | 87 | 95 |
| Arnold von Winkelried | 60 | 88 | 73 | 30 |
| Artaxerxes II of Persia | 89 | 51 | 53 | 102 |
| Ashurbanipal | 99 | 43 | 85 | 90 |
| Askia Muhammed I | 81 | 23 | 61 | 52 |
| Atia Balba Caesonia | 85 | 43 | 70 | 78 |
| Aulus Gabinius | 78 | 32 | 69 | 56 |
| Aurelia Cotta | 89 | 48 | 56 | 70 |
| Avicenna | 72 | 68 | 93 | 105 |
| Babur | 48 | 78 | 51 | 95 |
| Baeda Maryam | 32 | 81 | 58 | 95 |
| Baldwin I of Constantinople | 51 | 85 | 65 | 111 |
| Baldwin I of Edessa | 94 | 45 | 90 | 91 |
| Baldwin I, Count of Hainaut | 88 | 45 | 67 | 90 |
| Baldwin Iron Arm | 23 | 81 | 67 | 100 |
| Barbarossa Hayreddin Pasha | 32 | 84 | 55 | 98 |
| Barnim I, Duke of Pomerania | 80 | — | 65 | — |
| Bartholomew Diaz de Novaes | 88 | 43 | 65 | 78 |
| Bartolome de Las Casas | 35 | 63 | 85 | 99 |
| Bayezid II | 36 | 78 | 68 | 99 |
| Ben Jonson | 65 | 45 | 81 | 80 |
| Benjamin Franklin | 55 | 70 | 96 | 108 |
| Beowulf | 56 | 93 | 87 | 132 |
| Bertrand Du Guesclin | 66 | 92 | 70 | 60 |
| Bess of Harwick | 70 | 28 | 78 | 48 |
| Bishop Hungar | 32 | 65 | 81 | 81 |
| Boethius | 35 | 70 | 88 | 103 |
| Bogislaw IV, Duke of Pomerania | 81 | 31 | 50 | 61 |
| Bohemond I | 44 | 79 | 53 | 86 |
| Boris Godunov | 99 | 43 | 90 | 96 |
| Brian Boru | 93 | 50 | 88 | 93 |
| Brunhilde | 47 | 87 | 65 | 78 |
| Brutus | 91 | 69 | 76 | 105 |
| Burchard von Schwanden | 23 | 83 | 70 | 99 |
| Burebista (King of Dacia) | 34 | 89 | 65 | 101 |
| Caesar | 95 | 75 | 62 | 103 |
| Caligula | 81 | 65 | 54 | 86 |
| Canute the Great | 72 | 90 | 86 | 128 |
| Canute VI of Denmark | 37 | 87 | 70 | 106 |
| Cardinal Richelieu | 91 | 50 | 80 | 100 |
| Casimir Pulaski | 21 | 82 | 65 | 95 |
| Castiglione Baldassare | 81 | 42 | 47 | 60 |
| Catherine de Medici | 88 | 43 | 76 | 92 |
| Catherine Howard | 82 | 31 | 51 | 56 |
| Catherine II | 96 | 48 | 90 | 95 |
| Catherine of Aragon | 93 | 66 | 86 | 102 |
| Catherine of Siena | 43 | 55 | 86 | 93 |
| Cesare Borgia | 45 | 80 | 55 | 95 |
| Chand Bibi | 54 | 84 | 66 | 103 |
| Changamire | 35 | 84 | 59 | 97 |
| Charlemagne | 94 | 78 | 65 | 101 |
| Charles Cornwallis | 35 | 84 | 77 | 110 |
| Charles de Lorraine, 4th duke of guise | 79 | 34 | 55 | 66 |
| Charles III | 84 | 51 | 57 | 91 |
| Charles IX of France | 80 | — | 60 | — |
| Charles Martel | 51 | 80 | 47 | 105 |
| Charles of Provence | — | 50 | 64 | — |
| Charles the Bald | 78 | 54 | 46 | 76 |
| Charles V | 91 | 77 | 70 | 105 |
| Charles VII of France | 81 | 42 | 70 | 62 |
| Charlotte Stanley, Countess of Derby | 45 | 81 | 50 | 91 |
| Chevalier de Bayard | 56 | 99 | 69 | 30 |
| Christina Gyllenstierna | 70 | 86 | 50 | 108 |
| Christina of Markyate | 45 | 45 | 81 | 75 |
| Christina of Saxony | 81 | 40 | 50 | 74 |
| Christopher Columbus | 95 | 60 | 85 | 100 |
| Christopher I of Denmark | 56 | 80 | 90 | 105 |
| Christopher Marlowe | 40 | 70 | 88 | 103 |
| Cicero | 92 | 80 | 65 | 108 |
| Claude de lorraine, Duke of Guise | 25 | 81 | 65 | 101 |
| Claudius | 85 | 46 | 75 | — |
| Constantine XI | 80 | 25 | 85 | 58 |
| Cornelius Otto Jansen | 56 | 32 | 79 | 64 |
| Cosimo de Medici | 98 | 56 | 78 | 97 |
| Cristopher Columbus | 96 | 62 | 82 | 100 |
| Cuhtuhlatah | 40 | 80 | 55 | 91 |
| Cyrus II | 99 | 45 | 90 | 90 |
| David Beaton | 85 | 59 | 66 | 78 |
| David I | 89 | 35 | 78 | 73 |
| Deborah Sampson | 32 | 80 | 55 | 89 |
| Demetrius of Pharos | 80 | 60 | 43 | 81 |
| Desiderius Erasmus | 75 | 71 | 91 | 108 |
| Dhuoda | 34 | 60 | 81 | 99 |
| Diane de Poitiers | 65 | 31 | 82 | 72 |
| Dicaearchus | 90 | 40 | 98 | 92 |
| Diego de Silva Velazquez | 70 | 50 | 89 | 84 |
| Diego Sarmiento de Acuna. | — | 21 | 55 | — |
| Diogenes | 70 | 42 | 88 | 79 |
| Diogenes Laertios | 53 | 94 | 86 | 30 |
| Don John of Austria | 33 | 79 | 60 | 95 |
| Don Quixote | 25 | 81 | 65 | 130 |
| Donatello | 65 | 75 | 88 | 30 |
| Duncan I | 84 | 21 | 70 | 55 |
| Duncan II | 79 | 31 | 69 | 62 |
| Eadred I | 82 | 43 | 51 | 72 |
| Earl of Shrewsbury | 20 | 84 | 66 | 100 |
| Edgar the Etheling | 81 | 55 | 45 | — |
| Edith of England | 72 | 20 | 80 | 54 |
| Edmund I | 89 | 46 | 75 | — |
| Edmund II | 80 | 41 | 56 | 73 |
| Edmund Spenser | 70 | 46 | 84 | 80 |
| Edward IV of England | 70 | 91 | 80 | 126 |
| Edward Jenner | 60 | 81 | 93 | 120 |
| Edward VI | 81 | 60 | 40 | 90 |
| El Cid | 44 | 89 | 67 | 110 |
| El Greco(Domenicos Theotocopoulos) | 91 | — | 98 | — |
| Eleanor of Aquitaine | 81 | 56 | 70 | 91 |
| Elfthrytd | 79 | 32 | 60 | 93 |
| Elizabeth I | 98 | 32 | 90 | — |
| Emma of Normandy | 84 | 49 | 60 | 76 |
| Emma Queen of Franks | 23 | 84 | 61 | 108 |
| Emperor Taizu | 79 | 38 | 60 | 75 |
| Empress Matilda | 81 | 34 | 60 | 70 |
| Epictetus | 51 | 83 | 81 | 30 |
| Erastosthenes | 82 | 63 | 97 | 100 |
| Eric IV of Denmark | 35 | 89 | 85 | 120 |
| Eric V of Denmark | 80 | 30 | 61 | 61 |
| Eric VI of Denmark | 81 | 42 | 56 | 71 |
| Ethan Allen | 43 | 81 | 50 | 106 |
| Ethelbald | 78 | 28 | 72 | 59 |
| Ethelred II the Unready | 84 | 45 | 60 | 79 |
| Ethelwulf | 81 | 25 | 70 | 56 |
| Euripedes | 85 | 55 | 91 | 120 |
| Ferdinand II | 85 | 55 | 65 | 89 |
| Ferdinand II of Aragon | 95 | 75 | 75 | 96 |
| Ferdinand Magellan | 96 | 65 | 73 | 98 |
| Ferdinand V of Spain (Ferdinand II of Castile) | 92 | 51 | 75 | 110 |
| Fernando Alvarez de Toledo, Duke of Alba | 32 | 81 | 56 | 98 |
| Ferrarius | 50 | 72 | 86 | 106 |
| Filippo Brunelleschi | 50 | 51 | 84 | 81 |
| Filips van Montmorency, Graaf van Hoorn | 78 | 45 | 55 | 75 |
| Flavius Belisarius | 65 | 97 | 76 | 30 |
| Frances II of France | 81 | 30 | 70 | — |
| Francesco Guicciardini | 50 | 65 | 87 | 97 |
| Francesco Petrarca | 77 | 60 | 94 | 30 |
| Francis Bacon | 75 | 70 | 92 | 105 |
| Francis de Lorraine, 2nd Duke of Guise | 21 | 84 | 61 | 99 |
| Francis I | 89 | 32 | 80 | 65 |
| Francis Marion | 34 | 81 | 60 | 100 |
| Francis of Assisi | 92 | 56 | 81 | 30 |
| Francisco de Ibarra | 41 | 80 | 49 | 91 |
| Frans Hals | 60 | — | 89 | — |
| Fredegund | 80 | 32 | 65 | 71 |
| Frederick Barbarossa | 89 | 56 | 60 | 92 |
| Frederick I Barbarossa | 84 | 32 | 75 | 71 |
| Frederick II, Duke of Swabia | 56 | 78 | 50 | 95 |
| Frederick III | 81 | 50 | 48 | 81 |
| Fredrick II | 61 | 88 | 59 | 111 |
| Fulk III of Anjou | 79 | 32 | 65 | 92 |
| Gaius Cilnius Maecenas | 32 | 63 | 85 | 100 |
| Gaius Cornelius Tacitus | 63 | 60 | 89 | 30 |
| Gaius Duilus | 42 | 83 | 65 | 110 |
| Gaius Julius Caesar Augustus | 75 | 91 | 75 | 126 |
| Gaius Marius | 32 | 85 | 75 | 113 |
| Gaius Plinius Caecilius Secund | 85 | 56 | 73 | 60 |
| Gaius Plinius Secundus | 94 | 46 | 76 | 33 |
| Gaius Terentias Varro | 99 | 40 | 93 | 30 |
| Galileo Galilei | 46 | 89 | 96 | 122 |
| Gao Guiying | 55 | 96 | 75 | 125 |
| Gaspard de Coligny | 86 | 53 | 65 | 89 |
| Genghis Khan | 50 | 97 | 91 | 130 |
| Geoffrey Chaucer | 88 | 61 | 89 | 100 |
| Geoffrey II of Anjou | 23 | 84 | 65 | 100 |
| Geoffrey of Monmouth | 50 | 36 | 85 | 69 |
| Geoffrey Plantagenet | 20 | 84 | 70 | 100 |
| George of Antioch | 43 | 97 | 91 | 30 |
| George Villiers, 1st Duke of Buckingham | 84 | 65 | 56 | — |
| George Washington | 62 | 90 | 82 | 126 |
| Georges de La Tour | 56 | 43 | 81 | 73 |
| Gerard David | 67 | 51 | 89 | 106 |
| Gerard de Ridefort | 55 | 93 | 76 | 30 |
| Gerardus Mercator | 22 | 65 | 81 | 96 |
| Gerhard von Malberg | 32 | 81 | 59 | 99 |
| Giordano Bruno | 72 | 60 | 81 | 99 |
| Giorgione (Giorgio da Castalfranco) | 50 | 40 | 79 | 73 |
| Giovanni Bellini | 56 | 40 | 81 | 71 |
| Giovanni Bicci de Medici | 79 | 41 | 56 | 73 |
| Giovanni Paolo | 31 | 79 | 60 | 95 |
| Giovanni Sforza | 80 | 28 | 61 | 58 |
| Girart de Roussillon | 50 | 85 | 70 | 114 |
| Gjergj Kastrioti Skanderbeg | 65 | 86 | 60 | 114 |
| Godfrey of Bouillon | 45 | 88 | 70 | 113 |
| Godfrid Haraldsson | 23 | 80 | 70 | 100 |
| Godwin | 81 | 31 | 50 | 62 |
| Gottfried von Hohenlohe | 31 | 81 | 56 | 91 |
| Gottschalk of Orbais | 32 | 56 | 81 | 87 |
| Granuaile (Grace O Malley) | 70 | 99 | 60 | 124 |
| Guiliano della Rovere, Pope Julius II | 89 | 40 | 66 | 106 |
| Gunther Von Wullersleben | 84 | 43 | 43 | 75 |
| Guru Amar Das | 41 | 54 | 81 | 80 |
| Guru Arjan Dev | 56 | — | 86 | — |
| Guru Nanak | 70 | 80 | 89 | 115 |
| Gustavus I | 84 | 43 | 60 | 80 |
| Gustavus II | 88 | 32 | 69 | 65 |
| Guy Fawkes | 86 | 46 | 51 | 77 |
| Hamilcar Barca | 53 | 83 | 64 | 111 |
| Hammurabi | 97 | 60 | 75 | 94 |
| Hannah Duston | 40 | 85 | 55 | 95 |
| Hannibal | 60 | 97 | 76 | 126 |
| Hans Holbein (the Younger) | 83 | 50 | 94 | 88 |
| Harald Klak Halfdansson | 81 | 42 | 68 | 70 |
| Harold II | 89 | 30 | 71 | 64 |
| Hartmann von Heldrungen | 34 | 88 | 70 | 111 |
| Hasdrubal the Fair | 21 | 81 | 65 | 101 |
| Heinrich von Hohenlohe | 56 | 88 | 73 | 116 |
| Heinrich von Tunna | 35 | 78 | 61 | 100 |
| Heinrich Walpot von Bassenheim | 21 | 81 | 70 | 100 |
| Henri I de Bourbon | 35 | 75 | 60 | 100 |
| Henry de Lorraine 3rd Duke of Guise | 84 | 32 | 55 | 64 |
| Henry Hudsun | 79 | 32 | 68 | 65 |
| Henry II de Bourbon | 83 | 32 | 65 | 61 |
| Henry II of England | 96 | 60 | 70 | 95 |
| Henry III | 81 | 43 | 53 | 76 |
| Henry IV | 40 | 99 | 95 | 138 |
| Henry Stuart, Lord Darnley | — | 32 | 68 | — |
| Henry the Lion | 89 | 40 | 70 | 73 |
| Henry the Navigator | 65 | 55 | 89 | 89 |
| Henry the Proud | 89 | 65 | 55 | 90 |
| Henry the Young King | 80 | 43 | 51 | 83 |
| Henry V of England | 65 | 91 | 80 | 126 |
| Henry VI of England | 78 | 20 | 71 | 51 |
| Henry VI, Holy Roman Emperor | 98 | 45 | 86 | 90 |
| Henry VII of England | 88 | 41 | 70 | 75 |
| Henry VIII | 93 | 50 | 90 | 91 |
| Hermann von Salza | 40 | 83 | 65 | 115 |
| Hernan Cortes | 91 | 65 | 70 | 101 |
| Hernando de Soto | 85 | 55 | 60 | 86 |
| Herodotus | 70 | 70 | 97 | 106 |
| Hieronymuch Bosch | 56 | 60 | 89 | 91 |
| Hildegard von Bingen | 65 | 61 | 94 | 30 |
| Hincmar of Rheims | 43 | 70 | 86 | 102 |
| Hippocrates | 78 | 48 | 96 | 90 |
| Horatio Nelson | 65 | 96 | 70 | 112 |
| Howard of Effingham | 55 | 85 | 60 | 114 |
| Huayna Capac | 43 | 86 | 67 | 115 |
| Hugh Latimer | 32 | 60 | 82 | 93 |
| Hugo Grotius | 51 | 46 | 81 | 77 |
| Humayun | 56 | 44 | 80 | 76 |
| Humfrid | 88 | 31 | 70 | 101 |
| Huneberc | 65 | — | 81 | 53 |
| Hypatia of Alexandria | 60 | 71 | 85 | 30 |
| Iamblichus | 86 | 50 | 85 | 30 |
| Ibn al-Haythan | 56 | 78 | 95 | 110 |
| Ibn Khaldun | 50 | 69 | 94 | 30 |
| Igor of Kiev | 81 | 60 | 28 | 59 |
| Il Sassetta (Stephano di Giovanni) | 56 | 40 | 79 | 75 |
| Isaac Israeli be Solomon | 50 | 80 | 98 | 115 |
| Isaac Newton | 80 | 50 | 98 | 90 |
| Isabella d'este | 80 | 33 | 65 | 65 |
| Isabella of Castile | 98 | 50 | 80 | — |
| Ivan III the Great of Russia | 98 | 56 | 75 | 91 |
| Ivan IV of Russia | 95 | 60 | 79 | 91 |
| Jacobus Arminius | 50 | 43 | 80 | 77 |
| Jacques Cartier | 60 | 73 | 93 | 108 |
| Jahangir | 40 | 55 | 78 | — |
| James Cook | 60 | 93 | 78 | 125 |
| James Hepburn, Earl of Bothwell | 84 | 45 | 40 | 73 |
| James II | 89 | 45 | 60 | 76 |
| James VI of Scotland | 85 | 40 | 65 | 73 |
| James Wolfe | 40 | 85 | 65 | 111 |
| Jan Hus | 65 | 43 | 85 | 75 |
| Jan Karol Chodkiewicz | 23 | 81 | 60 | 100 |
| Jan van Eyck | 50 | 50 | 80 | 111 |
| Jan Zizka | 46 | 91 | 83 | 30 |
| Jane Austin | 36 | 71 | 88 | 106 |
| Jean Boudin | 65 | 23 | 80 | 85 |
| Jeanne d'Evreux | 68 | 41 | 92 | 61 |
| Joachim Patinir | 53 | 40 | 81 | 73 |
| Joan of Arc | 75 | 98 | 86 | 30 |
| Joan of England, Queen of Sicily | 80 | 63 | 35 | 86 |
| Joan of Kent | 80 | 45 | 53 | 75 |
| Johann georg Faust | 56 | 80 | 98 | 115 |
| Johann Sebastian Bach | 83 | 46 | 98 | 90 |
| Johannes Faustes | 62 | 99 | 94 | 101 |
| Johannes Gutenberg | 80 | 50 | 84 | 90 |
| John Cabot | 82 | 23 | 65 | 51 |
| John Calvin | 98 | 45 | 75 | 91 |
| John Carver | 80 | 50 | 43 | 80 |
| John Foxe | 80 | 22 | 70 | 65 |
| John gutenberg | 65 | 71 | 90 | 30 |
| John Hampden | 81 | — | 60 | — |
| John Hancock | 81 | 43 | 50 | 73 |
| John Hunyadi | 32 | 85 | 75 | 117 |
| John III of Portugal | 86 | 40 | 55 | — |
| John Jewel | 60 | 21 | 84 | 54 |
| John Keats | 35 | 60 | 78 | 88 |
| John Kourkouas | 43 | 89 | 60 | 116 |
| John Milton | 60 | 23 | 82 | 55 |
| John of England | 80 | 23 | 62 | 65 |
| John Paul Jones | 20 | 83 | 58 | 100 |
| John Sobieski | 86 | 53 | 61 | 83 |
| John Wesley | 55 | 61 | 86 | 95 |
| John Wycliffe | 58 | 75 | 90 | 30 |
| Joseph Caro | 82 | 46 | 95 | 90 |
| Juan Borgia | 82 | — | 46 | — |
| Juan Sanchez Cotan | 50 | 31 | 81 | 76 |
| Kabir | 56 | 31 | 84 | 65 |
| Kasimir II, Duke of Pomerania | 81 | 35 | 50 | 66 |
| Kassia | 35 | 70 | 89 | 103 |
| Konrad von Feuchtwangen | 35 | 89 | 70 | 113 |
| Konrad von Thuringen | 21 | 80 | 70 | 100 |
| Koxinga | 35 | 88 | 60 | 98 |
| Lacydes of Cyrene | 60 | 40 | 79 | 74 |
| Lamoral Egmont, Count of Garve | 80 | 43 | 50 | 73 |
| Lancelot Andrewes | 56 | 35 | 81 | 70 |
| Leif Ericson | 24 | 60 | 80 | 91 |
| Leon Battista Alberti | 45 | 83 | 85 | — |
| Leonardo da Vinci | 65 | 80 | 90 | 111 |
| Li Shangyin | 60 | 23 | 84 | 55 |
| Livy | 53 | 77 | 97 | 110 |
| Lord Thomas Howard | 25 | 83 | 77 | 115 |
| Lorenzo de' Medici | 83 | 25 | 77 | 70 |
| Lorenzo Lotto | 43 | 56 | 81 | 30 |
| Lothair I | 72 | 21 | 60 | — |
| Lothair III, Holy Roman Emperor | 85 | 30 | 70 | 70 |
| Louis of Bourbon-Conde | 25 | 78 | 70 | 100 |
| Louis the German | 25 | 84 | 61 | 98 |
| Louis the Pious | 36 | 84 | 75 | 110 |
| Louis the Stammerer | 80 | 31 | 65 | 62 |
| Louis XI of France | 92 | 70 | 73 | 103 |
| Louis XIV | 92 | 65 | 78 | 99 |
| Louis XVI | 83 | 62 | 60 | 90 |
| Louise of Savoy | — | 39 | 60 | — |
| Lucas Cranach (the Elder) | 60 | 51 | 84 | 81 |
| Lucius Annaeus Seneca | 94 | 70 | 68 | 30 |
| Lucius Cornelius Sulla | 96 | 50 | 79 | 30 |
| Lucius Sergius Catilina | 78 | — | 70 | — |
| Lucrezia Borgia 1 | 91 | 60 | 75 | 70 |
| Lucrezia Borgia 2 | — | 32 | 69 | — |
| Ludovico Sforza | 84 | 36 | 58 | 66 |
| Luigi Pulci | 84 | 59 | 59 | 59 |
| Lukianos | 99 | 40 | 86 | 30 |
| Lupus Servatus | 46 | 70 | 85 | 101 |
| MacBeth | 25 | 84 | 64 | 100 |
| Machiavelli | 86 | 67 | 82 | 30 |
| Mahmud of Ghazna | 50 | 88 | 56 | 111 |
| Malcolm I of Scotland | 42 | 84 | 79 | 110 |
| Malcolm III of Scotland | 79 | 21 | 60 | 55 |
| Manius Curius Dentatus | 21 | 80 | 54 | 100 |
| Manuela Beltran | 50 | 85 | 75 | 113 |
| Marco Polo | 70 | 77 | 85 | 30 |
| Marcus Antonius | 88 | 35 | 65 | 70 |
| Marcus Junious Brutus | 89 | 30 | 70 | 70 |
| Marcus Porcius Cato | 79 | 25 | 60 | 55 |
| Marcus Tullius Cicero | 90 | 53 | 73 | 108 |
| Marcus Vipsanius Agrippa | 95 | 41 | 86 | 30 |
| Margaret Beaufort | 65 | 30 | 81 | 95 |
| Margaret Corbin | 46 | 85 | 70 | 110 |
| Margaret Douglas | 81 | — | 67 | — |
| Margaret of Anjou | 85 | 36 | 70 | 70 |
| Margaret Tudor | 95 | 65 | 75 | 97 |
| Marguerite of Navarre | 70 | 32 | 88 | 70 |
| Marquis de Lafayette | 32 | 89 | 78 | 115 |
| Martin Luther | 80 | 70 | 97 | 30 |
| Mary I of Scotland | 84 | 30 | 76 | 70 |
| Mary I of Scotland (Mary Queen of Scots) | — | 51 | 86 | — |
| Mary Read | 40 | 79 | 60 | 95 |
| Mathis Grunewald | 60 | 30 | 79 | 91 |
| Matthew Stewart, 4th Earl of Lennox | — | 32 | 65 | — |
| Matthias Corvinus of Hungary | 34 | 88 | 70 | 111 |
| Maximus of Ephesus | 80 | 50 | 85 | 30 |
| Mehmed II | 51 | 96 | 81 | 125 |
| Meister Eckhart | 84 | 50 | 84 | 30 |
| Mestwin I, Duke of Pomerania | 81 | 29 | 60 | 66 |
| Mestwin II, Duke of Pomerania | 23 | 81 | 70 | 100 |
| Michael Drayton | 23 | 65 | 78 | 95 |
| Michaelangelo | 75 | 65 | 91 | — |
| Michel de Ruyter | 40 | 81 | 56 | 130 |
| Michelango Merisi da Caravaggio | 65 | 40 | 84 | 73 |
| Michelengelo | 39 | 60 | 80 | 93 |
| Mithridates II | 84 | 56 | 53 | 86 |
| Miyamoto Musashi | 50 | 86 | 56 | 110 |
| Moliere | 56 | 56 | 83 | 88 |
| Montcalm | 40 | 88 | 65 | 113 |
| Montezuma I | 84 | 40 | 67 | 75 |
| Muhammad ibn Saud | 84 | 35 | 70 | 75 |
| Muncimir of Croatia | 80 | 36 | 61 | 59 |
| Murad II | 35 | 89 | 80 | 120 |
| Myles Coverdale | 45 | 55 | 80 | 86 |
| Nadar Shah | 65 | 98 | 75 | 128 |
| Nancy Ward | 80 | 55 | 60 | 86 |
| Napoleon Bonaparte | 60 | 97 | 85 | 125 |
| Nennius | 61 | 45 | 85 | 76 |
| Niccolo de Conti | 84 | 43 | 51 | 103 |
| Nicholas Poussin | 56 | 60 | 85 | 92 |
| Nicholas the Great | 75 | 61 | 88 | 70 |
| Nicolaus Copernicus | 80 | 56 | 94 | 92 |
| Niels Ebbesen | 60 | 99 | 65 | 30 |
| Ogier the Dane | 30 | 81 | 60 | 100 |
| Olaudah Equiano | 80 | 48 | 41 | 76 |
| Olga Prekrasa of Kiev | 40 | 88 | 65 | 111 |
| Oliver Cromwell | 94 | 80 | 60 | 105 |
| Origen | 97 | 42 | 89 | — |
| Origenes Adamantius | — | 52 | 80 | — |
| Otto I | 70 | 90 | 80 | 125 |
| Otto Von Kerpen | 42 | 81 | 50 | 95 |
| Ovid | 72 | 70 | 95 | 103 |
| Pachacuti | 56 | 97 | 90 | 133 |
| Paolo Uccello | 42 | — | 79 | — |
| Paolo Veronese | 71 | 51 | 84 | 82 |
| Paracelsus | 78 | 60 | 97 | 30 |
| Paul Revere | 31 | 79 | 58 | 98 |
| Paulina Busa | 60 | 35 | 80 | 68 |
| Pepin the Short | 81 | 30 | 54 | 62 |
| Peter Abelard | 79 | 66 | 91 | 30 |
| Peter the Great | 94 | 56 | 76 | 90 |
| Peter the Hermit | 78 | — | 85 | — |
| Petronilla of Aquitaine | 81 | 40 | 58 | 71 |
| Philaenis of Samos | 41 | 38 | 82 | 70 |
| Philip V | 82 | 21 | 60 | 63 |
| Philippe de Commines | 50 | 46 | 84 | 76 |
| Philochorus | 31 | 60 | 84 | 90 |
| Photios I of Constantinople | 70 | 32 | 89 | 70 |
| Pierre Terrail LeVieux Seigneur de Bayard | 50 | 94 | 59 | 98 |
| Pieter Bruegal (The Elder) | 77 | 35 | 80 | — |
| Plato | 56 | 66 | 98 | 100 |
| Pliny the Younger | 94 | 70 | 55 | 95 |
| Plutarchus | 92 | 51 | 82 | 30 |
| Pope Gregory XIII | 55 | 51 | 84 | 84 |
| Pope Paul III (Alessandro Farnese) | 79 | 40 | 56 | 72 |
| Pope Urban I | 82 | 43 | 66 | 73 |
| Poppo von Osterna | 34 | 82 | 68 | 105 |
| Ptolemy Keraunos | 89 | 31 | 70 | 70 |
| Publius Cornelius Lentulus Sura | 91 | 53 | 85 | 30 |
| Publius Cornelius Lentulus Sura | 86 | 50 | 82 | 86 |
| Publius Cornelius Scipio | 60 | 91 | 70 | 30 |
| Publius Ovidius Naso | 62 | 56 | 94 | 30 |
| Punyaslok Rajmata Ahilyadevi | 41 | 86 | 71 | 113 |
| Qianlong Emperor | 32 | 86 | 75 | 111 |
| Queen Aliquippa | 25 | 80 | 70 | 100 |
| Queen Anne | 81 | 32 | 60 | 70 |
| Queen Nanny of the Maroons | 56 | — | 81 | — |
| Quintus Fabius Pictor | 56 | 34 | 79 | 66 |
| Quintus Fulvius Flaccus | 45 | 78 | 55 | 105 |
| Quintus Servilius Caepio the Younger | 78 | 45 | 55 | 75 |
| Raimondo Montecuccoli | 42 | 81 | 56 | 95 |
| Raja Raja Cholal | 80 | 41 | 56 | 72 |
| Ralpacan | 97 | 46 | 87 | 91 |
| Rani Rudrama Devi | 85 | 45 | 80 | 79 |
| Raphael | 76 | 66 | 89 | 30 |
| Raphael (Raffaello Sanzio) | 61 | 65 | 95 | 95 |
| Rene Descartes | 45 | — | 85 | — |
| Richard Hooker | 34 | 61 | 78 | 91 |
| Richard III of England | 80 | 45 | 45 | 75 |
| Richard Neville, Earl of Warwick | 84 | 40 | 66 | 75 |
| Richard Plantagenet, 3rd Duke of York | 97 | 46 | 89 | 97 |
| Richard the Lionheart | 50 | 97 | 78 | 125 |
| Robert Blake | 46 | 86 | 60 | 111 |
| Robert Browne | 81 | 33 | 60 | 95 |
| Robert Cecil | 85 | 35 | 65 | — |
| Robert Devereux, 2nd Earl of Essex | 86 | 30 | 70 | 71 |
| Robert Devereux, 3rd Earl of Essex | 35 | 79 | 55 | 95 |
| Robert Dudley, 1st Earl of Leicester | 79 | 31 | 60 | 61 |
| Robert Guiscard | 34 | 78 | 30 | 95 |
| Robin Hood | 57 | 97 | 69 | 124 |
| Rodrigo Borgia | 81 | 43 | 46 | 73 |
| Roger Ascham | 35 | 60 | 84 | 90 |
| Roger Bacon | 66 | 70 | 94 | 30 |
| Roger Bacon 1 | 70 | 65 | 94 | 99 |
| Roger Bacon 2 | 56 | 46 | 89 | 77 |
| Roger De Moulins | 98 | 99 | 40 | 30 |
| Rorik of Dorestad | 32 | 81 | 60 | 100 |
| Rubens | 60 | 50 | 82 | 87 |
| Rudolph of France | 80 | 33 | 62 | 65 |
| Rurik | 52 | 85 | 63 | 110 |
| Sa'adiah ben Yosef Gaon | 46 | 51 | 81 | 86 |
| Saint Zachary | 80 | 46 | 45 | 76 |
| Saladin | 45 | 98 | 91 | 131 |
| Salvestro de' Medici | 81 | 40 | 56 | 73 |
| Samuel Daniel | 70 | — | 79 | — |
| Samuel de Champlain | 87 | 50 | 71 | 85 |
| Sandro Botecelli 2 | 54 | 51 | 85 | 85 |
| Sandro Botticelli 1 | 46 | 42 | 80 | 78 |
| Sargon | 97 | 70 | 60 | 101 |
| Saxo Grammaticus | 46 | 51 | 79 | 83 |
| Sejong the Great | 68 | 92 | 76 | 123 |
| Sennacherib | 98 | 55 | 67 | 91 |
| Shah Abbas | 94 | 50 | 75 | 91 |
| Shah Ismail I Safavi | 81 | 44 | 45 | 75 |
| Shah Jahan | 85 | 70 | 55 | 100 |
| Shulgi | 71 | 51 | 94 | 86 |
| Silvius Brabo | 61 | 95 | 66 | 30 |
| Simeon I | 35 | 87 | 75 | 116 |
| Simon De Montfort | 70 | 95 | 64 | 30 |
| Sir Agravain | 35 | 81 | 49 | 98 |
| Sir Edward Coke | 84 | 61 | 55 | 90 |
| Sir Francis Drake | 94 | 61 | 68 | 97 |
| Sir Gawain | 34 | 78 | 56 | 94 |
| Sir Humphrey Gilbert | 84 | 54 | 59 | 86 |
| Sir John Hawkins | 30 | 81 | 56 | 124 |
| Sir Philip Sidney | 50 | 80 | 95 | 116 |
| Sir Richard Grenville | 80 | 43 | 50 | 85 |
| Sir Richard Hawkins | 35 | 84 | 51 | 93 |
| Sir Thomas Gresham | 84 | 23 | 64 | 56 |
| sir william wallace | 75 | 85 | 82 | 30 |
| Socrates | 45 | 60 | 85 | 91 |
| Sonni Ali | 45 | 85 | 60 | 111 |
| Sophocles | 70 | 65 | 90 | 102 |
| St. Anselm | 85 | 65 | 60 | 103 |
| St. Bernard of Clairvaux | 94 | 66 | 80 | 98 |
| St. Bruno of Cologne | 61 | 43 | 84 | — |
| St. Edmund Campion | 79 | 54 | 46 | 79 |
| St. Edward the Confessor | 81 | 56 | 60 | 89 |
| St. Francis Xavier | 56 | 55 | 86 | 116 |
| St. Hildebrand, Pope Gregory VII | 89 | 53 | 56 | 74 |
| St. Ignatius Loyola | 67 | 48 | 99 | 105 |
| St. John of the Cross | 40 | 55 | 79 | 89 |
| St. Leo IX | 82 | 50 | 46 | 80 |
| Stephen Gardiner | 80 | 40 | 51 | 73 |
| Stephen III of Moldavia | 46 | 85 | 65 | 111 |
| Sviatopolk II of Pomerania | 32 | 81 | 65 | 100 |
| Sybil Ludington | 46 | 46 | 79 | 76 |
| Tamerlane | 32 | 86 | 70 | 114 |
| Taticius | 76 | 85 | 71 | 30 |
| Tertullian | 94 | 59 | 78 | 94 |
| Thaddeus Kosciuszko | 42 | 63 | 70 | 100 |
| Theodora The Armenian | 79 | 45 | 51 | 112 |
| Theophilos | 99 | 50 | 76 | 91 |
| Thomas Campion | 60 | 43 | 84 | 77 |
| Thomas Cranmer | 91 | 60 | 83 | 95 |
| Thomas Cromwell | 93 | 72 | 72 | 102 |
| Thomas Erastus | 43 | — | 79 | — |
| Thomas Hobbes | 67 | — | 88 | — |
| Thomas Jefferson | 96 | 66 | 75 | 96 |
| Thomas Malory | 61 | 21 | 81 | 51 |
| Thucidides | 67 | 40 | 85 | 103 |
| Tintoretto (Jacopo Comin Robusti) | 60 | 60 | 82 | 91 |
| Tippu Sultan | 32 | 81 | 56 | 97 |
| Titian | 88 | 50 | 93 | 91 |
| Titian (Tiziano Vecellio) | 88 | 70 | 93 | — |
| Titus Livius | 59 | 60 | 92 | 30 |
| Titus Lucretius Carus | 45 | 78 | 99 | 30 |
| Tokugawa Ieyasu | 21 | 84 | 60 | 96 |
| Toyotomi Hideyoshi | 41 | 85 | 64 | 110 |
| Tupac Inca Yapanqui | 23 | 84 | 65 | 96 |
| Utu-hengal | 85 | 50 | 56 | 81 |
| Valdemar I of Denmark | 56 | — | 56 | — |
| Valdemar II of Denmark | 67 | 93 | 75 | 126 |
| Vasco De Gama | 70 | 84 | 83 | 30 |
| Vasco Nu?ez de Balboa | 50 | 99 | 94 | 139 |
| Viracocha | 52 | 83 | 70 | 111 |
| Vittore Carpaccio | 34 | 60 | 81 | 92 |
| Vlad Dracula | 60 | 94 | 81 | 125 |
| vlad tepes | 67 | 97 | 61 | 30 |
| Vlad the Impaler | 43 | 98 | 81 | 126 |
| Vladimir I | 82 | 50 | 60 | 86 |
| Vladimir the Great | 43 | 60 | 89 | 91 |
| Voltaire | 67 | 45 | 89 | 78 |
| Walter Raleigh | 94 | 60 | 86 | 99 |
| Wang Cong'er | 43 | 90 | 79 | 115 |
| Wartislaw III, Duke of Pomerania | 22 | 84 | 65 | 100 |
| Willem Barentsz | 35 | 70 | 86 | 105 |
| William Bradford | 94 | 80 | 65 | 110 |
| William Cecil | 91 | — | 70 | — |
| William Herschel | 46 | 61 | 83 | 92 |
| William III | 46 | 85 | 66 | 111 |
| William Laud | 82 | 46 | 70 | 80 |
| William Pitt the Elder | 81 | 51 | 70 | 83 |
| William Shakespeare | 64 | 68 | 97 | 100 |
| William Tell | 35 | 83 | 68 | 111 |
| William the Conqueror | 70 | 95 | 73 | 124 |
| William VIII, Duke of Aquitaine | 23 | 79 | 76 | 100 |
| William Wallace | 65 | 97 | 50 | 126 |
| Wolfgang Amadeus Mozart | 73 | 45 | 99 | 91 |
| Xenophon | 73 | — | 94 | — |
| Yi Jongmu | 38 | 78 | 51 | 94 |
| Zara Yaqob | 50 | 50 | 89 | 80 |
| Zheng He | 32 | 84 | 50 | 94 |
| Zhu Di | 92 | 56 | 76 | 90 |
| Zhu Gaozhi | 89 | 45 | 68 | 48 |
| Zhu Jianshen | 81 | 30 | 52 | 105 |
| Zhu Qizhen | 82 | 25 | 62 | 56 |
| Zhu Youtang | 84 | 45 | 61 | 78 |
| Zhu Zhanji | 88 | 40 | 65 | 73 |
| Zorayda | 34 | 80 | 56 | 94 |
