function shouldShowGroup(group, filters) {  
  return group.pins.some(pin => filterPins([pin], filters).length > 0);  
}  
