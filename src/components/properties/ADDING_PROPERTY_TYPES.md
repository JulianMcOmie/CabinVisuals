# Adding New Property Types and UI Controls

This guide explains how to add a new type of property that can be configured in a Synthesizer and how to create its corresponding UI control.

## Steps

1.  **Define the Data Type:**
    *   Determine the data structure needed for your new property type.
    *   If the type is reusable or complex, define an interface or type alias for it, typically within `src/lib/types.ts`. For simple types (`string`, `number`, `boolean`), this step might not be necessary.

    ```typescript
    // Example in src/lib/types.ts
    export interface MyCustomType {
        settingA: string;
        settingB: number;
    }
    ```

2.  **Create the UI Control Component:**
    *   Create a new React functional component in the `src/components/properties/` directory. Name it descriptively, e.g., `MyCustomTypePropertyControl.tsx`.
    *   The component **must** accept the following props:
        *   `property`: The `Property` instance itself (e.g., `Property<MyCustomType>`). Provides access to metadata like `label`, `min`, `max`, etc.
        *   `value`: The current value of the property (e.g., an instance of `MyCustomType`).
        *   `onChange`: A callback function `(newValue: MyCustomType) => void` to be called when the user changes the value in the UI.
    *   Implement the UI using standard React and potentially UI libraries (like Radix UI if used elsewhere in the project).
    *   Use the `property.metadata` to configure the UI elements (e.g., display `property.metadata.label`).
    *   Ensure the component correctly reflects the incoming `value` prop and calls `onChange` with the complete, updated value whenever the user modifies it.

    ```typescript
    // src/components/properties/MyCustomTypePropertyControl.tsx
    import React from 'react';
    import { Property } from '../../lib/properties/Property';
    import { MyCustomType } from '../../lib/types'; // Assuming defined in types.ts

    interface Props {
        property: Property<MyCustomType>;
        value: MyCustomType;
        onChange: (value: MyCustomType) => void;
    }

    const MyCustomTypePropertyControl: React.FC<Props> = ({ property, value, onChange }) => {
        const handleSettingAChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            onChange({ ...value, settingA: event.target.value });
        };

        const handleSettingBChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            onChange({ ...value, settingB: Number(event.target.value) });
        };

        return (
            <div>
                <label>{property.metadata.label || property.name}</label>
                {/* Input for settingA */}
                <input type="text" value={value.settingA} onChange={handleSettingAChange} />
                {/* Input for settingB */}
                <input type="number" value={value.settingB} onChange={handleSettingBChange} />
                {/* Add more complex UI elements as needed */}
            </div>
        );
    };

    export default MyCustomTypePropertyControl;
    ```

3.  **Integrate the UI Control:**
    *   Identify the component responsible for rendering the controls for a synthesizer's properties (this is likely `src/components/SynthesizerControls.tsx`, but may vary).
    *   Import your newly created `MyCustomTypePropertyControl` component into this file.
    *   Find the logic (usually a `switch` statement or series of `if/else` conditions) that determines which control component to render based on `property.metadata.uiType`.
    *   Add a new case for a unique `uiType` string that you will use for your new property type (e.g., `'myCustomType'`).
    *   In this new case, render your `MyCustomTypePropertyControl` component, passing the required `property`, `value`, and `onChange` props.

    ```typescript
    // Example modification in src/components/SynthesizerControls.tsx (simplified)
    import MyCustomTypePropertyControl from './properties/MyCustomTypePropertyControl'; // Import new control
    // ... other imports

    // Inside the component rendering properties:
    // ... mapping over properties ...
    switch (property.metadata.uiType) {
        // ... existing cases for 'slider', 'color', etc.
        case 'myCustomType': // Add new case
             control = (
                 <MyCustomTypePropertyControl
                     property={property as Property<MyCustomType>}
                     value={currentValue as MyCustomType}
                     onChange={(newValue) => handlePropertyValueChange(property.name, newValue)}
                 />
             );
             break;
        // ... default case ...
    }
    // ... render the control ...
    ```

4.  **Use the New Property Type in a Synthesizer:**
    *   In your synthesizer class (e.g., `src/lib/synthesizers/MySynth.ts`), import the `Property` class and your custom type (if defined).
    *   In the `initializeProperties` method, create a new `Property` instance.
    *   Provide your custom type as the generic parameter (`Property<MyCustomType>`).
    *   Set the `uiType` in the metadata object to the unique string you used in the integration step (e.g., `'myCustomType'`).
    *   Provide a default value that matches your custom type structure.

    ```typescript
    // Inside src/lib/synthesizers/MySynth.ts
    import { Property } from '../properties/Property';
    import { MyCustomType } from '../types'; // Import custom type

    // ... inside class ...
    private initializeProperties(): void {
        this.properties.set('customSetting', new Property<MyCustomType>(
            'customSetting', // Property key
            { settingA: 'defaultA', settingB: 10 }, // Default value
            { label: 'My Custom Setting', uiType: 'myCustomType' } // Metadata with uiType
        ));
        // ... other properties ...
    }
    ```

Now, when the synthesizer's controls are rendered, the application will use your custom UI component for properties with the matching `uiType`. 