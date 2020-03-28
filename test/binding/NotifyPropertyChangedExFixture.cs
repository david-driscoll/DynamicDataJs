describe('NotifyPropertyChangedExFixture', () => {
{
    [Theory,
    InlineData(true),
    InlineData(false)]
    public void SubscribeToValueChangeForAllItemsInList( bool notifyOnInitialValue)
{
    var lastAgeChange = -1;
    var source = new SourceList<Person>();
    source.Connect().WhenValueChanged(p => p.Age, notifyOnInitialValue).Subscribe(i => lastAgeChange = i);
    var person = new Person("Name", 10);
    var anotherPerson = new Person("AnotherName", 10);
    source.Add(person);
    source.Add(anotherPerson);

(expect(notifyOnInitialValue ? 10 : -1)).toBe(lastAgeChange)
    person.Age = 12;
    expect(12).toBe(lastAgeChange)
    anotherPerson.Age = 13;
    expect(13).toBe(lastAgeChange)
}

[Theory,
    InlineData(true),
    InlineData(false)]
public void SubscribeToValueChangedOnASingleItem( bool notifyOnInitialValue)
{
    var age = -1;
    var person = new Person("Name", 10);
    person.WhenValueChanged(p => p.Age, notifyOnInitialValue).Subscribe(i => age = i);

    (expect(notifyOnInitialValue ? 10 : -1)).toBe(age)
    person.Age = 12;
    expect(12).toBe(age)
    person.Age = 13;
    expect(13).toBe(age)
}

[Theory,
    InlineData(true),
    InlineData(false)]
public void SubscribeToPropertyChangeForAllItemsInList( bool notifyOnInitialValue)
{
    var lastChange = new PropertyValue<Person, int>(null, -1);
    var source = new SourceList<Person>();
    source.Connect().WhenPropertyChanged(p => p.Age, notifyOnInitialValue).Subscribe(c => lastChange = c);
    var person = new Person("Name", 10);
    var anotherPerson = new Person("AnotherName", 10);
    source.Add(person);
    source.Add(anotherPerson);

    if (notifyOnInitialValue)
    {
        expect(anotherPerson).toBe(lastChange.Sender)
        expect(10).toBe(lastChange.Value)
    }
    else
    {
        lastChange.Sender.Should().BeNull();
        (-expect(1)).toBe(lastChange.Value)
    }

    person.Age = 12;
    expect(person).toBe(lastChange.Sender)
    expect(12).toBe(lastChange.Value)
    anotherPerson.Age = 13;
    expect(anotherPerson).toBe(lastChange.Sender)
    expect(13).toBe(lastChange.Value)
}

[Theory,
    InlineData(true),
    InlineData(false)]
public void SubscribeToProperyChangedOnASingleItem( bool notifyOnInitialValue)
{
    var lastChange = new PropertyValue<Person, int>(null, -1);
    var person = new Person("Name", 10);
    person.WhenPropertyChanged(p => p.Age, notifyOnInitialValue).Subscribe(c => lastChange = c);

    if (notifyOnInitialValue)
    {
        expect(person).toBe(lastChange.Sender)
        expect(10).toBe(lastChange.Value)
    }
    else
    {
        lastChange.Sender.Should().BeNull();
        (-expect(1)).toBe(lastChange.Value)
    }

    person.Age = 12;
    expect(person).toBe(lastChange.Sender)
    expect(12).toBe(lastChange.Value)
    person.Age = 13;
    expect(person).toBe(lastChange.Sender)
    expect(13).toBe(lastChange.Value)
}

}