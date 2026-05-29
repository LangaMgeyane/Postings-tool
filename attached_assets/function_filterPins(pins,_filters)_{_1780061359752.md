function filterPins(pins, filters) {  
  return pins.filter(pin => {  
    const topicMatch =  
      filters.topics.length === 0 ||  
      pin.topics.some(t => filters.topics.includes(t));  
  
    const ideologyMatch =  
      filters.ideologies.length === 0 ||  
      pin.ideologies.some(i => filters.ideologies.includes(i));  
  
    const authorMatch =  
      filters.authors.length === 0 ||  
      pin.authors.some(a => filters.authors.includes(a.id));  
  
    const beliefMatch =  
      filters.beliefs.length === 0 ||  
      pin.beliefTags.some(b => filters.beliefs.includes(b));  
  
    return topicMatch && ideologyMatch && authorMatch && beliefMatch;  
  });  
}  
