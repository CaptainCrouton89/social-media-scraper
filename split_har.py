#!/usr/bin/env python3
import json
import os
from collections import defaultdict

def split_har_file(har_file_path):
    """Split a HAR file into smaller files organized by resource type."""
    
    # Read the original HAR file
    with open(har_file_path, 'r') as f:
        har_data = json.load(f)
    
    # Create output directory
    base_name = os.path.splitext(os.path.basename(har_file_path))[0]
    output_dir = f"{base_name}_split"
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract metadata (everything except entries)
    metadata = {
        "log": {
            "version": har_data["log"]["version"],
            "creator": har_data["log"]["creator"],
            "pages": har_data["log"]["pages"]
        }
    }
    
    # Save metadata
    with open(f"{output_dir}/metadata.json", 'w') as f:
        json.dump(metadata, f, indent=2)
    
    # Group entries by resource type
    entries_by_type = defaultdict(list)
    for entry in har_data["log"]["entries"]:
        resource_type = entry.get("_resourceType", "unknown")
        entries_by_type[resource_type].append(entry)
    
    # Save each resource type to separate files
    file_manifest = {
        "metadata_file": "metadata.json",
        "resource_files": {}
    }
    
    for resource_type, entries in entries_by_type.items():
        filename = f"entries_{resource_type}.json"
        filepath = f"{output_dir}/{filename}"
        
        with open(filepath, 'w') as f:
            json.dump({"entries": entries}, f, indent=2)
        
        file_manifest["resource_files"][resource_type] = {
            "file": filename,
            "count": len(entries)
        }
        
        print(f"Created {filename} with {len(entries)} entries")
    
    # Save manifest file
    with open(f"{output_dir}/manifest.json", 'w') as f:
        json.dump(file_manifest, f, indent=2)
    
    print(f"\nSplit complete! Files saved in '{output_dir}' directory")
    print(f"Total entries: {sum(len(entries) for entries in entries_by_type.values())}")
    
    return output_dir

if __name__ == "__main__":
    har_file = "/Users/silasrhyneer/Code/social-media-scraper/www.reddit.com.har"
    split_har_file(har_file)