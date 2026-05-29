## Pin Board Filtering + Context System (Replit Implementation Spec)  
**1. Core Data Model Requirements**  
Each **Pin** must support:  
Each **Pin** must support:  
* id: string  
* content: string | rich media  
* authors: Author[]  
* topics: string[]  
* ideologies: string[]  
* beliefTags: string[]  
* createdAt: timestamp  
* groupId?: string | null (if part of a Pin Group)  
Each **Pin Group** must support:  
* id: string  
* pins: Pin[]  
* authors: Author[] *(union of all pin authors OR group-level authors)*  
* topics: string[] *(derived aggregate from pins)*  
* ideologies: string[]  
* beliefTags: string[]  
Each **Author**:  
* id: string  
* name: string  
* userId?: string (if platform user)  
* tags: string[] (optional classification)  
   
⸻  
   
**2. Filtering System Logic**  
The board must support filtering across:  
* **Authors**  
* **Topics**  
* **Ideologies**  
* **Belief Tags**  
**Filtering rules:**  
* Filters apply to BOTH:  
    * Individual Pins  
    * Pin Groups (via aggregated metadata)  
* A Pin Group is shown if:  
    * At least ONE pin matches filter criteria  
* Matching logic:  
    * OR within a category (e.g., topic A OR topic B)  
    * AND across categories (e.g., topic match AND ideology match)  
   
⸻  
   
**3. Selection + Context System (Critical UI Behavior)**  
There must be a single stateful control:  
```
inViewInContextButton

```
This is ONE button that reflects selection state.  
**States:**  
* noneSelected  
* pinSelected  
* pinGroupSelected  
* stickyNoteSelected  
**Behavior:**  
When an item is selected:  
* Store:  
    * selectedType  
    * selectedId  
    * selectedMetadata  
* UI button updates dynamically:  
    * Shows current selection type  
    * Indicates whether item is “in context view”  
   
⸻  
   
**4. Context-Aware Filtering Layer**  
When something is selected, filters should optionally pivot based on:  
**A. Authorship Awareness**  
* If selected item has authors:  
    * Suggest or auto-filter related content by same authors  
**B. Membership Relationship**  
* If user is:  
    * author of selected item OR  
    * member of group OR  
    * previously interacted with similar tags  
Then:  
* Prioritise:  
    * related pins  
    * same-author content  
    * same-topic clusters  
   
⸻  
   
**5. UI Behaviour Rules**  
**Pin / Group Selection:**  
* Clicking a Pin or Group:  
    * sets selection state  
    * activates inViewInContextButton  
    * activates inViewInContextButton  
**Sticky Notes:**  
* treated as separate selectable entity type  
* included in same selection system  
**Deselect:**  
* clicking empty space resets:  
    * selection state  
    * context filters (optional toggle behavior)  
