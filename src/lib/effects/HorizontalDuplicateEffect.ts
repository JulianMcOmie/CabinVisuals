import Effect from '../Effect';
import { VisualObject } from '../types';
import { Property } from '../properties/Property';

class HorizontalDuplicateEffect extends Effect {
    constructor() {
        super();
        this.initializeProperties();
    }

    private initializeProperties(): void {
        this.properties.set('numCopies', new Property<number>(
            'numCopies',
            3,
            { label: 'Copies', uiType: 'slider', min: 1, max: 10, step: 1 }
        ));
        this.properties.set('xSpread', new Property<number>(
            'xSpread',
            2.0,
            { label: 'X Spread', uiType: 'slider', min: 0.0, max: 10.0, step: 0.1 }
        ));
    }

    applyEffect(objects: VisualObject[], time: number, bpm: number): VisualObject[] {
        const numCopies = Math.max(1, Math.floor(this.getPropertyValue<number>('numCopies') ?? 1));
        const xSpread = this.getPropertyValue<number>('xSpread') ?? 0;

        const outputObjects: VisualObject[] = [];

        if (numCopies <= 1 && xSpread === 0) {
            return objects; // No duplication or spread needed, return original objects
        }

        objects.forEach(obj => {
            const originalPos = obj.properties.position ?? [0, 0, 0];
            const [ox, oy, oz] = originalPos;

            const totalWidth = (numCopies - 1) * xSpread;
            const startX = ox - totalWidth / 2;

            for (let i = 0; i < numCopies; i++) {
                const copyX = startX + i * xSpread;
                
                // Manually create a new object with cloned properties
                const newObj: VisualObject = {
                    ...obj, // Copy top-level properties (like type, sourceNoteId)
                    properties: {
                        ...obj.properties, // Copy existing properties
                        position: [copyX, oy, oz] // Set the new position (creates a new array)
                    }
                };
                 
                // Ensure other potentially mutable properties are also cloned if they exist
                // Although this effect only changes position, it's good practice:
                if (obj.properties.scale) {
                    newObj.properties.scale = [...obj.properties.scale];
                }
                if (obj.properties.rotation) {
                    newObj.properties.rotation = [...obj.properties.rotation];
                }
                if (obj.properties.velocity) {
                    newObj.properties.velocity = [...obj.properties.velocity];
                }
                
                outputObjects.push(newObj);
            }
        });

        return outputObjects;
    }

    clone(): this {
        const cloned = new HorizontalDuplicateEffect() as this;
        this.properties.forEach((prop, key) => {
            const clonedProp = cloned.properties.get(key);
            if (clonedProp) {
                clonedProp.value = prop.value;
            }
        });
        return cloned;
    }
}

export default HorizontalDuplicateEffect; 